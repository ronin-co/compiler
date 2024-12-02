import type { Model as PrivateModel, PublicModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import type { NativeRecord, Result, Row } from '@/src/types/result';
import { compileQueryInput } from '@/src/utils';
import { expand, splitQuery } from '@/src/utils/helpers';
import {
  ROOT_MODEL,
  addDefaultModelFields,
  addDefaultModelPresets,
  getFieldFromModel,
  getModelBySlug,
  getSystemModels,
} from '@/src/utils/model';

export class Transaction {
  statements: Array<Statement>;
  models: Array<PrivateModel> = [];

  private queries: Array<Query>;

  constructor(
    queries: Array<Query>,
    options?: Parameters<typeof this.compileQueries>[2] & { models?: Array<PublicModel> },
  ) {
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
    options?: {
      inlineParams?: boolean;
    },
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

  private formatRecord(model: PrivateModel, record: NativeRecord): NativeRecord {
    const formattedRecord = { ...record };

    for (const key in record) {
      const { field } = getFieldFromModel(model, key, 'to');

      if (field.type === 'json') {
        formattedRecord[key] = JSON.parse(record[key] as string);
        continue;
      }

      formattedRecord[key] = record[key];
    }

    return expand(formattedRecord) as NativeRecord;
  }

  prepareResults(results: Array<Array<Row>>): Array<Result> {
    // Filter out results whose statements are not expected to return any data.
    const relevantResults = results.filter((_, index) => {
      return this.statements[index].returning;
    });

    return relevantResults.map((result, index): Result => {
      const query = this.queries.at(-index) as Query;
      const { queryModel } = splitQuery(query);
      const model = getModelBySlug(this.models, queryModel);

      // Whether the query will interact with a single record, or multiple at the same time.
      const single = queryModel !== model.pluralSlug;

      // The query is targeting a single record.
      if (single) {
        return { record: this.formatRecord(model, result[0] as NativeRecord) };
      }

      // The query is targeting multiple records.
      return {
        records: result.map((resultItem) => {
          return this.formatRecord(model, resultItem as NativeRecord);
        }),
      };
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
