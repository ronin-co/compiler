import {
  ROOT_MODEL,
  ROOT_MODEL_WITH_ATTRIBUTES,
  getModelBySlug,
  getSystemModels,
} from '@/src/model';
import {
  addDefaultModelAttributes,
  addDefaultModelFields,
  addDefaultModelPresets,
} from '@/src/model/defaults';
import type {
  InternalModelField,
  Model as PrivateModel,
  PublicModel,
} from '@/src/types/model';
import type {
  AllQueryInstructions,
  InternalQuery,
  Query,
  Statement,
} from '@/src/types/query';
import type {
  ExpandedResult,
  MultipleRecordResult,
  ObjectRow,
  RawRow,
  RegularResult,
  Result,
  ResultRecord,
} from '@/src/types/result';
import { compileQueryInput } from '@/src/utils';
import { getProperty, omit, setProperty, splitQuery } from '@/src/utils/helpers';
import { generatePaginationCursor } from '@/src/utils/pagination';

interface TransactionOptions {
  /** A list of models that already exist in the database. */
  models?: Array<PublicModel>;
  /**
   * Place statement parameters directly inside the statement strings instead of
   * separating them out into a dedicated `params` array.
   */
  inlineParams?: boolean;
  /**
   * Whether to compute default field values as part of the generated statement.
   */
  inlineDefaults?: boolean;
}

class Transaction {
  statements: Array<Statement> = [];
  models: Array<PrivateModel> = [];

  #internalQueries: Array<InternalQuery> = [];

  constructor(queries: Array<Query>, options?: TransactionOptions) {
    const models = options?.models || [];

    this.#internalQueries = queries.map((query) => ({ query, selectedFields: [] }));
    this.#compileQueries(models, options);
  }

  /**
   * Composes SQL statements for the provided RONIN queries.
   *
   * @param models - A list of models.
   * @param options - Additional options to adjust the behavior of the statement generation.
   *
   * @returns The composed SQL statements.
   */
  #compileQueries = (
    models: Array<PublicModel>,
    options?: Omit<TransactionOptions, 'models'>,
  ): Array<Statement> => {
    const modelsWithAttributes = models.map((model) => {
      return addDefaultModelAttributes(model, true);
    });

    const modelsWithFields = [
      ...modelsWithAttributes.flatMap((model) => {
        return getSystemModels(modelsWithAttributes, model);
      }),
      ...[ROOT_MODEL_WITH_ATTRIBUTES, ...modelsWithAttributes],
    ].map((model) => {
      return addDefaultModelFields(model, true);
    });

    const modelsWithPresets = modelsWithFields.map((model) => {
      return addDefaultModelPresets(modelsWithFields, model);
    });

    const statements: Array<Statement> = [];

    // Check if the list of queries contains any queries with the model `all`, as those
    // must be expanded into multiple queries.
    const expandedQueries: Array<{ query: Query; expansionIndex?: number }> =
      this.#internalQueries.flatMap(({ query }, expansionIndex) => {
        const { queryType, queryModel, queryInstructions } = splitQuery(query);

        // If the model defined in the query is called `all`, that means we need to expand
        // the query into multiple queries: One for each model.
        if (queryModel === 'all') {
          const { for: forInstruction, ...restInstructions } = (queryInstructions ||
            {}) as AllQueryInstructions;

          let modelList = modelsWithAttributes;

          // If a `for` instruction was provided, that means we only want to select the
          // related models of the model that was provided in `for`, instead of selecting
          // all models at once.
          if (forInstruction) {
            const mainModel = getModelBySlug(modelsWithAttributes, forInstruction);

            modelList = Object.values(mainModel.fields || {})
              .filter((field) => field.type === 'link')
              .map((field) => {
                return modelsWithAttributes.find(
                  (model) => model.slug === field.target,
                ) as PrivateModel;
              });
          }

          return modelList.map((model) => {
            const query: Query = {
              [queryType]: { [model.pluralSlug]: restInstructions },
            };

            return { query, expansionIndex };
          });
        }

        return { query };
      });

    for (let index = 0; index < expandedQueries.length; index++) {
      const { query, expansionIndex } = expandedQueries[index];

      const { dependencies, main, selectedFields } = compileQueryInput(
        query,
        modelsWithPresets,
        options?.inlineParams ? null : [],

        // biome-ignore lint/complexity/useSimplifiedLogicExpression: This is needed.
        { inlineDefaults: options?.inlineDefaults || false },
      );

      // Every query can only produce one main statement (which can return output), but
      // multiple dependency statements (which must be executed either before or after
      // the main one, but cannot return output themselves).
      //
      // The main statements, unlike the dependency statements, are expected to produce
      // output, and that output should be a 1:1 match between RONIN queries and SQL
      // statements, meaning one RONIN query should produce one main SQL statement.
      const preDependencies = dependencies.filter(({ after }) => !after);
      const postDependencies = dependencies
        .map(({ after, ...rest }) => (after ? rest : null))
        .filter((item) => item != null);
      const subStatements = [...preDependencies, main, ...postDependencies];

      // These statements will be made publicly available (outside the compiler).
      this.statements.push(...subStatements);

      // Update the internal query with additional information.
      //
      // In the case that a expension index is available, we want to update the original
      // query from which the current query was derived/expanded.
      const queryIndex = typeof expansionIndex === 'undefined' ? index : expansionIndex;
      this.#internalQueries[queryIndex].selectedFields = selectedFields;
    }

    this.models = modelsWithPresets;

    return statements;
  };

  #formatRows<RecordType = ResultRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: true,
  ): RecordType;
  #formatRows<RecordType = ResultRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: false,
  ): Array<RecordType>;

  #formatRows<RecordType = ResultRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: boolean,
  ): RecordType | Array<RecordType> {
    const records: Array<ResultRecord> = [];

    for (const row of rows) {
      const record = fields.reduce((acc, field, fieldIndex) => {
        let newSlug = field.mountingPath;
        let newValue = row[fieldIndex];

        // If the value of the field isn't empty, format it.
        if (newValue !== null) {
          if (field.type === 'json' || field.type === 'blob') {
            newValue = JSON.parse(newValue as string);
          } else if (field.type === 'boolean') {
            newValue = Boolean(newValue);
          }
        }

        const { parentField, parentIsArray } = ((): {
          parentField: string | null;
          parentIsArray?: true;
        } => {
          const lastDotIndex = newSlug.lastIndexOf('.');
          if (lastDotIndex === -1) return { parentField: null };

          const parent = newSlug.slice(0, lastDotIndex);

          if (parent.endsWith('[0]')) {
            return { parentField: parent.slice(0, -3), parentIsArray: true };
          }

          return { parentField: parent };
        })();

        if (parentField) {
          // If the field is nested into another field and the current field is the ID of
          // a nested record, we need to set the parent field to `null` if the ID is
          // empty, because IDs are always defined, so if the ID is empty, that means the
          // nested record doesn't exist.
          //
          // Similarily, if the parent field is an array, the value we are saving should
          // be an empty array instead of `null`.
          if (field.slug === 'id' && newValue === null) {
            newSlug = parentField;
            newValue = parentIsArray ? [] : null;
          }

          const parentFields = newSlug
            .split('.')
            .map((_, index, array) => array.slice(0, index + 1).join('.'))
            .reverse();

          // If one of the parent fields of the current field is set to `null` or an
          // empty array, that means the nested record doesn't exist, so we can skip
          // setting the current field, since its value is `null` anyways.
          if (
            parentFields.some((item) => {
              const isArray = item.endsWith('[0]');
              const value = getProperty(acc, item.replaceAll('[0]', ''));
              return isArray
                ? Array.isArray(value) && value.length === 0
                : value === null;
            })
          ) {
            return acc;
          }
        }

        setProperty(acc, newSlug, newValue);
        return acc;
      }, {} as ResultRecord);

      const existingRecord = record.id
        ? records.find((existingRecord) => {
            return existingRecord.id === record.id;
          })
        : null;

      // In the most common scenario that there isn't already a record with the same ID
      // as the current row, we can simply add the record to the list of records.
      //
      // If there is already a record with the same ID, however, that means the current
      // row is the result of a JOIN operation, in which case we need to push the values
      // of the current row into the arrays on the existing record.
      if (!existingRecord) {
        records.push(record);
        continue;
      }

      const joinFields = fields.reduce((acc, { mountingPath }) => {
        if (mountingPath.includes('[0]')) acc.add(mountingPath.split('[0]')[0]);
        return acc;
      }, new Set<string>());

      for (const arrayField of joinFields.values()) {
        const currentValue = existingRecord[arrayField] as Array<ResultRecord>;
        const newValue = record[arrayField] as Array<ResultRecord>;

        for (const newRecord of newValue) {
          if ('id' in newRecord) {
            const existingIndex = currentValue.findIndex((value) => {
              return value.id === newRecord.id;
            });

            if (existingIndex > -1) {
              Object.assign(currentValue[existingIndex], newRecord);
              continue;
            }
          }

          currentValue.push(newRecord);
        }
      }
    }

    return single ? (records[0] as RecordType) : (records as Array<RecordType>);
  }

  formatSingleResult<RecordType>(
    query: Query,
    model: PrivateModel,
    rows: Array<Array<RawRow>>,
    selectedFields: Array<InternalModelField>,
    single: boolean,
  ): RegularResult<RecordType> {
    const { queryType, queryInstructions } = splitQuery(query);

    // Allows the client to format fields whose type cannot be serialized in JSON,
    // which is the format in which the compiler output is sent to the client.
    const modelFields = Object.fromEntries(
      Object.entries(model.fields).map(([slug, rest]) => [slug, rest.type]),
    );

    // The query is expected to count records.
    if (queryType === 'count') {
      return { amount: rows[0][0] as unknown as number };
    }

    // The query is targeting a single record.
    if (single) {
      return {
        record: rows[0] ? this.#formatRows<RecordType>(selectedFields, rows, true) : null,
        modelFields,
      };
    }

    const pageSize = queryInstructions?.limitedTo;

    // The query is targeting multiple records.
    const result: MultipleRecordResult<RecordType> = {
      records: this.#formatRows<RecordType>(selectedFields, rows, false),
      modelFields,
    };

    // If the amount of records was limited to a specific amount, that means pagination
    // should be activated. This is only possible if the query matched any records.
    if (pageSize && result.records.length > 0) {
      // Pagination cursor for the next page.
      if (result.records.length > pageSize) {
        // Remove one record from the list, because we always load one too much, in
        // order to see if there are more records available.
        if (queryInstructions?.before) {
          result.records.shift();
        } else {
          result.records.pop();
        }

        const direction = queryInstructions?.before ? 'moreBefore' : 'moreAfter';
        const lastRecord = result.records.at(
          direction === 'moreAfter' ? -1 : 0,
        ) as ResultRecord;

        result[direction] = generatePaginationCursor(
          model,
          queryInstructions.orderedBy,
          lastRecord,
        );
      }

      // Pagination cursor for the previous page. Only available if an existing
      // cursor was provided in the query instructions.
      if (queryInstructions?.before || queryInstructions?.after) {
        const direction = queryInstructions?.before ? 'moreAfter' : 'moreBefore';
        const firstRecord = result.records.at(
          direction === 'moreAfter' ? -1 : 0,
        ) as ResultRecord;

        result[direction] = generatePaginationCursor(
          model,
          queryInstructions.orderedBy,
          firstRecord,
        );
      }
    }

    return result;
  }

  formatResults<RecordType>(
    results: Array<Array<ObjectRow>>,
    raw?: false,
  ): Array<Result<RecordType>>;
  formatResults<RecordType>(
    results: Array<Array<RawRow>>,
    raw?: true,
  ): Array<Result<RecordType>>;

  /**
   * Format the results returned from the database into RONIN records.
   *
   * @param results - A list of results from the database, where each result is an array
   * of rows.
   * @param raw - By default, rows are expected to be objects. If the driver being used
   * returns rows as arrays of values (which is how SQL databases return rows directly),
   * this option should be set to `true`.
   *
   * @returns A list of formatted RONIN results, where each result is either a single
   * RONIN record, an array of RONIN records, or a RONIN count result.
   */
  formatResults<RecordType>(
    results: Array<Array<RawRow>> | Array<Array<ObjectRow>>,
    raw = false,
  ): Array<Result<RecordType>> {
    // Only retain the results of SQL statements that are expected to return data.
    const cleanResults = results.filter((_, index) => this.statements[index].returning);

    let resultIndex = 0;

    return this.#internalQueries.reduce(
      (finalResults: Array<Result<RecordType>>, internalQuery) => {
        const { query, selectedFields } = internalQuery;

        const { queryModel } = splitQuery(query);

        if (queryModel === 'all') {
          const modelList = this.models.filter((model) => model.slug !== ROOT_MODEL.slug);
          const models: ExpandedResult<RecordType>['models'] = {};

          for (const model of modelList) {
            const defaultRows = cleanResults[resultIndex++];

            // If the provided results are raw (rows being arrays of values, which is the most
            // ideal format in terms of performance, since the driver doesn't need to format
            // the rows in that case), we can already continue processing them further.
            //
            // If the provided results were already formatted by the driver (rows being
            // objects), we need to normalize them into the raw format first, before they can
            // be processed, since the object format provided by the driver does not match
            // the RONIN record format expected by developers.
            const rows = raw
              ? (defaultRows as Array<Array<RawRow>>)
              : (defaultRows.map((row) => {
                  // If the row is already an array, return it as-is.
                  if (Array.isArray(row)) return row;

                  // If the row is the result of a `count` query, return its amount result.
                  if (query.count) return [row.amount];

                  // If the row is an object, return its values as an array.
                  return Object.values(row);
                }) as Array<Array<RawRow>>);

            const result = this.formatSingleResult<RecordType>(
              query,
              model,
              rows,
              selectedFields,
              false,
            );

            models[model.pluralSlug] = result;
          }

          finalResults.push({ models });
        } else {
          const defaultRows = cleanResults[resultIndex++];

          // If the provided results are raw (rows being arrays of values, which is the most
          // ideal format in terms of performance, since the driver doesn't need to format
          // the rows in that case), we can already continue processing them further.
          //
          // If the provided results were already formatted by the driver (rows being
          // objects), we need to normalize them into the raw format first, before they can
          // be processed, since the object format provided by the driver does not match
          // the RONIN record format expected by developers.
          const rows = raw
            ? (defaultRows as Array<Array<RawRow>>)
            : (defaultRows.map((row) => {
                // If the row is already an array, return it as-is.
                if (Array.isArray(row)) return row;

                // If the row is the result of a `count` query, return its amount result.
                if (query.count) return [row.amount];

                // If the row is an object, return its values as an array.
                return Object.values(row);
              }) as Array<Array<RawRow>>);

          const model = getModelBySlug(this.models, queryModel);

          // Whether the query will interact with a single record, or multiple at the same time.
          const single = queryModel !== model.pluralSlug;

          const result = this.formatSingleResult<RecordType>(
            query,
            model,
            rows,
            selectedFields,
            single,
          );

          finalResults.push(result);
        }

        return finalResults;
      },
      [] as Array<Result<RecordType>>,
    );
  }
}

// Expose model types
export type {
  PublicModel as Model,
  ModelField,
  ModelIndex,
  ModelTrigger,
  ModelPreset,
} from '@/src/types/model';

// Expose query types
export type {
  // Queries
  Query,
  QueryType,
  QueryInstructionType as QueryInstruction,
  QuerySchemaType,
  // Query Types
  GetQuery,
  GetInstructions,
  GetInstructions as GetQueryInstructions,
  SetQuery,
  SetInstructions,
  SetInstructions as SetQueryInstructions,
  AddQuery,
  AddInstructions,
  AddInstructions as AddQueryInstructions,
  RemoveQuery,
  RemoveInstructions,
  RemoveInstructions as RemoveQueryInstructions,
  CountQuery,
  CountInstructions,
  CountInstructions as CountQueryInstructions,
  CreateQuery,
  AlterQuery,
  DropQuery,
  // Query Instructions
  WithInstruction,
  CombinedInstructions,
  // Compiled Queries
  Statement,
  // Miscellaneous
  StoredObject,
} from '@/src/types/query';

// Expose result types
export type {
  Result,
  RegularResult,
  ExpandedResult,
  ResultRecord,
} from '@/src/types/result';

// Strip any properties from the root model that are internal
const CLEAN_ROOT_MODEL = omit(ROOT_MODEL, ['system']) as PublicModel;

// Expose the main `Transaction` entrypoint and the root model
export { Transaction, CLEAN_ROOT_MODEL as ROOT_MODEL };

// Expose the main error class and query symbols
export { RoninError, QUERY_SYMBOLS, getQuerySymbol } from '@/src/utils/helpers';
