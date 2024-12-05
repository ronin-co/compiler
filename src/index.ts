import type { Model as PrivateModel, PublicModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import type {
  MultipleRecordResult,
  NativeRecord,
  RawRow,
  Result,
  Row,
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
    }

    this.models = modelListWithPresets;

    // First return all dependency statements, and then all main statements. This is
    // essential since the dependency statements are expected to not produce any output, so
    // they should be executed first. The main statements, on the other hand, are expected
    // to produce output, and that output should be a 1:1 match between RONIN queries and
    // SQL statements, meaning one RONIN query should produce one main SQL statement.
    return [...dependencyStatements, ...mainStatements];
  };

  private formatRow(model: PrivateModel, row: RawRow): NativeRecord {
    const record: Partial<NativeRecord> = {};

    for (let index = 0; index < row.length; index++) {
      const value = row[index];
      const field = model.fields[index];

      if (field.type === 'json') {
        record[field.slug] = JSON.parse(value as string);
        continue;
      }

      record[field.slug] = value;
    }

    return expand(record) as NativeRecord;
  }

  prepareResults(results: Array<Array<Row>>): Array<Result> {
    // Filter out results whose statements are not expected to return any data.
    const relevantResults = results.filter((_, index) => {
      return this.statements[index].returning;
    });

    const normalizedResults: Array<Array<RawRow>> = relevantResults.map((rows) => {
      return rows.map((row) => {
        if (Array.isArray(row)) return row;
        if (row['COUNT(*)']) return [row['COUNT(*)']];
        return Object.values(row);
      });
    });

    return normalizedResults.map((rows, index): Result => {
      const query = this.queries.at(-index) as Query;
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
        return { record: this.formatRow(model, rows[0]) };
      }

      const pageSize = queryInstructions?.limitedTo;

      // The query is targeting multiple records.
      const output: MultipleRecordResult = {
        records: rows.map((row) => this.formatRow(model, row)),
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
