import {
  PLURAL_MODEL_ENTITIES_VALUES,
  ROOT_MODEL,
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
import type { InternalStatement, Query, Statement } from '@/src/types/query';
import type {
  MultipleRecordResult,
  NativeRecord,
  ObjectRow,
  RawRow,
  Result,
} from '@/src/types/result';
import { compileQueryInput } from '@/src/utils';
import { omit, setProperty, splitQuery } from '@/src/utils/helpers';
import { generatePaginationCursor } from '@/src/utils/pagination';

interface TransactionOptions {
  /** A list of models that already exist in the database. */
  models?: Array<PublicModel>;
  /**
   * Place statement parameters directly inside the statement strings instead of
   * separating them out into a dedicated `params` array.
   */
  inlineParams?: boolean;
  /** Alias column names that are duplicated when joining multiple tables. */
  expandColumns?: boolean;
}

class Transaction {
  statements: Array<Statement> = [];
  models: Array<PrivateModel> = [];

  #internalStatements: Array<InternalStatement> = [];

  constructor(queries: Array<Query>, options?: TransactionOptions) {
    const models = options?.models || [];

    this.#compileQueries(queries, models, options);
  }

  /**
   * Composes SQL statements for the provided RONIN queries.
   *
   * @param queries - The RONIN queries for which SQL statements should be composed.
   * @param models - A list of models.
   * @param options - Additional options to adjust the behavior of the statement generation.
   *
   * @returns The composed SQL statements.
   */
  #compileQueries = (
    queries: Array<Query>,
    models: Array<PublicModel>,
    options?: Omit<TransactionOptions, 'models'>,
  ): Array<Statement> => {
    const modelsWithAttributes = [ROOT_MODEL, ...models].map((model) => {
      return addDefaultModelAttributes(model, true);
    });

    const modelsWithFields = [
      ...modelsWithAttributes.flatMap((model) => {
        return getSystemModels(modelsWithAttributes, model);
      }),
      ...modelsWithAttributes,
    ].map((model) => {
      return addDefaultModelFields(model, true);
    });

    const modelsWithPresets = modelsWithFields.map((model) => {
      return addDefaultModelPresets(modelsWithFields, model);
    });

    const statements: Array<Statement> = [];

    for (const query of queries) {
      const result = compileQueryInput(
        query,
        modelsWithPresets,
        options?.inlineParams ? null : [],
        { expandColumns: options?.expandColumns },
      );

      // Every query can only produce one main statement (which can return output), but
      // multiple dependency statements (which must be executed before the main one, but
      // cannot return output themselves).
      //
      // The order is essential, since the dependency statements are expected to not
      // produce any output, so they should be executed first. The main statements, on the
      // other hand, are expected to produce output, and that output should be a 1:1 match
      // between RONIN queries and SQL statements, meaning one RONIN query should produce
      // one main SQL statement.
      const subStatements = [...result.dependencies, result.main];

      // These statements will be made publicly available (outside the compiler).
      this.statements.push(...subStatements);

      // These statements will be used internally to format the results.
      this.#internalStatements.push(
        ...subStatements.map((statement) => ({
          ...statement,
          query,
          selectedFields: result.selectedFields,
        })),
      );
    }

    this.models = modelsWithPresets;

    return statements;
  };

  #formatRows<Record = NativeRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: true,
    isMeta: boolean,
  ): Record;
  #formatRows<Record = NativeRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: false,
    isMeta: boolean,
  ): Array<Record>;

  #formatRows<Record = NativeRecord>(
    fields: Array<InternalModelField>,
    rows: Array<RawRow>,
    single: boolean,
    isMeta: boolean,
  ): Record | Array<Record> {
    const records: Array<NativeRecord> = [];

    for (const row of rows) {
      const record = fields.reduce((acc, field, fieldIndex) => {
        const newSlug = field.mountingPath;
        let newValue = row[fieldIndex];

        if (field.type === 'json') {
          newValue = JSON.parse(newValue as string);
        } else if (field.type === 'boolean') {
          newValue = Boolean(newValue);
        }

        // If the query is used to alter the database schema, the result of the query
        // will always be a model, because the only available queries for altering the
        // database schema are `create.model`, `alter.model`, and `drop.model`. That means
        // we need to ensure that the resulting record always matches the `Model` type,
        // by formatting its fields accordingly.
        if (
          isMeta &&
          (PLURAL_MODEL_ENTITIES_VALUES as ReadonlyArray<string>).includes(newSlug)
        ) {
          newValue = newValue
            ? Object.entries(newValue as object).map(([slug, attributes]) => {
                return { slug, ...attributes };
              })
            : [];
        }

        setProperty(acc, newSlug, newValue);
        return acc;
      }, {} as NativeRecord);

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

      const joinFields = fields.reduce(
        (acc, { mountingPath }) => {
          return mountingPath.includes('[0]') &&
            !acc.includes(mountingPath.split('[0]')[0])
            ? acc.concat([mountingPath.split('[0]')[0]])
            : acc;
        },
        [] as Array<string>,
      );

      for (const arrayField of joinFields) {
        const currentValue = existingRecord[arrayField] as Array<NativeRecord>;
        const newValue = record[arrayField] as Array<NativeRecord>;

        currentValue.push(...newValue);
      }
    }

    return single ? (records[0] as Record) : (records as Array<Record>);
  }

  formatResults<Record>(
    results: Array<Array<ObjectRow>>,
    raw?: false,
  ): Array<Result<Record>>;
  formatResults<Record>(results: Array<Array<RawRow>>, raw?: true): Array<Result<Record>>;

  /**
   * Format the results returned from the database into RONIN records.
   *
   * @param results - A list of results from the database, where each result is an array
   * of rows.
   * @param raw - By default, rows are expected to be arrays of values, which is how SQL
   * databases return rows by default. If the driver being used returns rows as objects
   * instead, this option should be set to `false`.
   *
   * @returns A list of formatted RONIN results, where each result is either a single
   * RONIN record, an array of RONIN records, or a RONIN count result.
   */
  formatResults<Record>(
    results: Array<Array<RawRow>> | Array<Array<ObjectRow>>,
    raw = true,
  ): Array<Result<Record>> {
    // If the provided results are raw (rows being arrays of values, which is the most
    // ideal format in terms of performance, since the driver doesn't need to format
    // the rows in that case), we can already continue processing them further.
    //
    // If the provided results were already formatted by the driver (rows being objects),
    // we need to normalize them into the raw format first, before they can be processed,
    // since the object format provided by the driver does not match the RONIN record
    // format expected by developers.
    const normalizedResults: Array<Array<RawRow>> = raw
      ? (results as Array<Array<RawRow>>)
      : results.map((rows) => {
          return rows.map((row) => {
            if (Array.isArray(row)) return row;
            if (row['COUNT(*)']) return [row['COUNT(*)']];
            return Object.values(row);
          });
        });

    const formattedResults = normalizedResults.map(
      (rows, index): Result<Record> | null => {
        const { returning, query, selectedFields } = this.#internalStatements[index];

        // If the statement is not expected to return any data, there is no need to format
        // any results, so we can return early.
        if (!returning) return null;

        const { queryType, queryModel, queryInstructions } = splitQuery(query);
        const model = getModelBySlug(this.models, queryModel);

        // Whether the query interacts with the database schema.
        const isMeta = queryModel === 'model' || queryModel === 'models';

        // Allows the client to format fields whose type cannot be serialized in JSON,
        // which is the format in which the compiler output is sent to the client.
        const modelFields = Object.fromEntries(
          model.fields.map((field) => [field.slug, field.type]),
        );

        // The query is expected to count records.
        if (queryType === 'count') {
          return { amount: rows[0][0] as number };
        }

        // Whether the query will interact with a single record, or multiple at the same time.
        const single = queryModel !== model.pluralSlug;

        // The query is targeting a single record.
        if (single) {
          return {
            record: rows[0]
              ? this.#formatRows<Record>(selectedFields, rows, true, isMeta)
              : null,
            modelFields,
          };
        }

        const pageSize = queryInstructions?.limitedTo;

        // The query is targeting multiple records.
        const output: MultipleRecordResult<Record> = {
          records: this.#formatRows<Record>(selectedFields, rows, false, isMeta),
          modelFields,
        };

        // If the amount of records was limited to a specific amount, that means pagination
        // should be activated. This is only possible if the query matched any records.
        if (pageSize && output.records.length > 0) {
          // Pagination cursor for the next page.
          if (output.records.length > pageSize) {
            // Remove one record from the list, because we always load one too much, in
            // order to see if there are more records available.
            if (queryInstructions?.before) {
              output.records.shift();
            } else {
              output.records.pop();
            }

            const direction = queryInstructions?.before ? 'moreBefore' : 'moreAfter';
            const lastRecord = output.records.at(
              direction === 'moreAfter' ? -1 : 0,
            ) as NativeRecord;

            output[direction] = generatePaginationCursor(
              model,
              queryInstructions.orderedBy,
              lastRecord,
            );
          }

          // Pagination cursor for the previous page. Only available if an existing
          // cursor was provided in the query instructions.
          if (queryInstructions?.before || queryInstructions?.after) {
            const direction = queryInstructions?.before ? 'moreAfter' : 'moreBefore';
            const firstRecord = output.records.at(
              direction === 'moreAfter' ? -1 : 0,
            ) as NativeRecord;

            output[direction] = generatePaginationCursor(
              model,
              queryInstructions.orderedBy,
              firstRecord,
            );
          }
        }

        return output;
      },
    );

    // Filter out results whose statements are not expected to return any data.
    return formattedResults.filter((result) => result !== null);
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
  // Query Instructions
  WithInstruction,
  CombinedInstructions,
  // Compiled Queries
  Statement,
} from '@/src/types/query';

// Expose result types
export type { Result } from '@/src/types/result';

// Strip any properties from the root model that are internal
const CLEAN_ROOT_MODEL = omit(ROOT_MODEL, ['system']) as PublicModel;

// Expose the main `Transaction` entrypoint and the root model
export { Transaction, CLEAN_ROOT_MODEL as ROOT_MODEL };

// Expose the main error class and query symbols
export { RoninError, QUERY_SYMBOLS } from '@/src/utils/helpers';
