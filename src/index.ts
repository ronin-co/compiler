import type { ModelField, Model as PrivateModel, PublicModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import type {
  MultipleRecordResult,
  NativeRecord,
  ObjectRow,
  RawRow,
  Result,
} from '@/src/types/result';
import { compileQueryInput } from '@/src/utils';
import { expand, omit, splitQuery } from '@/src/utils/helpers';
import {
  ROOT_MODEL,
  addDefaultModelFields,
  addDefaultModelPresets,
  getModelBySlug,
  getSystemModels,
} from '@/src/utils/model';
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
  statements: Array<Statement>;
  models: Array<PrivateModel> = [];

  private queries: Array<Query>;
  private fields: Array<Array<ModelField>> = [];

  constructor(queries: Array<Query>, options?: TransactionOptions) {
    const models = options?.models || [];

    this.statements = this.compileQueries(queries, models, options);
    this.queries = queries;
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
  private compileQueries = (
    queries: Array<Query>,
    models: Array<PublicModel>,
    options?: Omit<TransactionOptions, 'models'>,
  ): Array<Statement> => {
    const modelList = [
      ROOT_MODEL,
      ...models.flatMap((model) => getSystemModels(models, model)),
      ...models,
    ].map((model) => {
      return addDefaultModelFields(model, true);
    });

    const modelListWithPresets = modelList.map((model) => {
      return addDefaultModelPresets(modelList, model);
    });

    const dependencyStatements: Array<Statement> = [];
    const mainStatements: Array<Statement> = [];

    for (const query of queries) {
      const result = compileQueryInput(
        query,
        modelListWithPresets,
        options?.inlineParams ? null : [],
        { expandColumns: options?.expandColumns },
      );

      // Every query can only produce one main statement (which can return output), but
      // multiple dependency statements (which must be executed before the main one, but
      // cannot return output themselves).
      dependencyStatements.push(...result.dependencies);
      mainStatements.push(result.main);

      this.fields.push(result.loadedFields);
    }

    this.models = modelListWithPresets;

    // First return all dependency statements, and then all main statements. This is
    // essential since the dependency statements are expected to not produce any output, so
    // they should be executed first. The main statements, on the other hand, are expected
    // to produce output, and that output should be a 1:1 match between RONIN queries and
    // SQL statements, meaning one RONIN query should produce one main SQL statement.
    return [...dependencyStatements, ...mainStatements];
  };

  private formatRow(fields: Array<ModelField>, row: RawRow): NativeRecord {
    const record: Partial<NativeRecord> = {};

    for (let index = 0; index < row.length; index++) {
      const value = row[index];
      const field = fields[index];

      let newSlug = field.slug;
      let newValue = value;

      const parentFieldSlug = (field as ModelField & { parentField?: string })
        .parentField;

      // If the field is nested into a parent field, prefix it with the slug of the parent
      // field, which causes it to get nested into a parent object in the final record.
      if (parentFieldSlug) {
        newSlug = `${parentFieldSlug}.${field.slug}`;
      }

      if (field.type === 'json') {
        newValue = JSON.parse(value as string);
      }

      record[newSlug] = newValue;
    }

    return expand(record) as NativeRecord;
  }

  formatResults(results: Array<Array<RawRow>>, raw?: true): Array<Result>;
  formatResults(results: Array<Array<ObjectRow>>, raw?: false): Array<Result>;

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
  formatResults(
    results: Array<Array<RawRow>> | Array<Array<ObjectRow>>,
    raw = true,
  ): Array<Result> {
    // Filter out results whose statements are not expected to return any data.
    const relevantResults = results.filter((_, index) => {
      return this.statements[index].returning;
    });

    // If the provided results are raw (rows being arrays of values, which is the most
    // ideal format in terms of performance, since the driver doesn't need to format
    // the rows in that case), we can already continue processing them further.
    //
    // If the provided results were already formatted by the driver (rows being objects),
    // we need to normalize them into the raw format first, before they can be processed,
    // since the object format provided by the driver does not match the RONIN record
    // format expected by developers.
    const normalizedResults: Array<Array<RawRow>> = raw
      ? (relevantResults as Array<Array<RawRow>>)
      : relevantResults.map((rows) => {
          return rows.map((row) => {
            if (Array.isArray(row)) return row;
            if (row['COUNT(*)']) return [row['COUNT(*)']];
            return Object.values(row);
          });
        });

    return normalizedResults.map((rows, index): Result => {
      const query = this.queries.at(-index) as Query;
      const fields = this.fields.at(-index) as Array<ModelField>;
      const { queryType, queryModel, queryInstructions } = splitQuery(query);
      const model = getModelBySlug(this.models, queryModel);

      // The query is expected to count records.
      if (queryType === 'count') {
        return { amount: rows[0][0] as number };
      }

      // Whether the query will interact with a single record, or multiple at the same time.
      const single = queryModel !== model.pluralSlug;

      // The query is targeting a single record.
      if (single) {
        return { record: this.formatRow(fields, rows[0]) };
      }

      const pageSize = queryInstructions?.limitedTo;

      // The query is targeting multiple records.
      const output: MultipleRecordResult = {
        records: rows.map((row) => this.formatRow(fields, row)),
      };

      // If the amount of records was limited to a specific amount, that means pagination
      // should be activated. This is only possible if the query matched any records.
      if (pageSize && output.records.length > 0) {
        // Pagination cursor for the previous page. Only available if an existing
        // cursor was provided in the query instructions.
        if (queryInstructions?.before || queryInstructions?.after) {
          const direction = queryInstructions?.before ? 'moreAfter' : 'moreBefore';
          const firstRecord = output.records[0] as NativeRecord;

          output[direction] = generatePaginationCursor(
            model,
            queryInstructions.orderedBy,
            firstRecord,
          );
        }

        // Pagination cursor for the next page.
        if (output.records.length > pageSize) {
          const direction = queryInstructions?.before ? 'moreBefore' : 'moreAfter';
          const lastRecord = output.records.pop() as NativeRecord;

          output[direction] = generatePaginationCursor(
            model,
            queryInstructions.orderedBy,
            lastRecord,
          );
        }
      }

      return output;
    });
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
export type { Query, Statement } from '@/src/types/query';

// Expose result types
export type { Result } from '@/src/types/result';

// Strip any properties from the root model that are internal
const CLEAN_ROOT_MODEL = omit(ROOT_MODEL, ['system']) as PublicModel;

// Expose the main `Transaction` entrypoint and the root model
export { Transaction, CLEAN_ROOT_MODEL as ROOT_MODEL };

// Expose the main error class and query symbols
export { RoninError, QUERY_SYMBOLS } from '@/src/utils/helpers';
