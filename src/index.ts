import type { PublicModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import type { NativeRecord, Result, Row } from '@/src/types/result';
import { compileQueryInput } from '@/src/utils';
import { splitQuery } from '@/src/utils/helpers';
import {
  addDefaultModelFields,
  addDefaultModelPresets,
  addSystemModels,
  getModelBySlug,
  transformMetaQuery,
} from '@/src/utils/model';

export class Transaction {
  statements: Array<Statement>;
  models: Array<PublicModel>;

  private queries: Array<Query>;

  constructor(
    queries: Array<Query>,
    options?: Parameters<typeof this.compileQueries>[2] & { models?: Array<PublicModel> },
  ) {
    const models = options?.models || [];

    this.statements = this.compileQueries(queries, models, options);
    this.models = models;
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
    const modelList = addSystemModels(models).map((model) => {
      return addDefaultModelFields(model, true);
    });

    const modelListWithPresets = modelList.map((model) => {
      return addDefaultModelPresets(modelList, model);
    });

    const dependencyStatements: Array<Statement> = [];
    const mainStatements: Array<Statement> = [];

    for (const query of queries) {
      const statementValues = options?.inlineParams ? null : [];

      const transformedQuery = transformMetaQuery(
        modelListWithPresets,
        dependencyStatements,
        statementValues,
        query,
      );

      const result = compileQueryInput(
        transformedQuery,
        modelListWithPresets,
        statementValues,
      );

      // Every query can only produce one main statement (which can return output), but
      // multiple dependency statements (which must be executed before the main one, but
      // cannot return output themselves).
      dependencyStatements.push(...result.dependencies);
      mainStatements.push(result.main);
    }

    // First return all dependency statements, and then all main statements. This is
    // essential since the dependency statements are expected to not produce any output, so
    // they should be executed first. The main statements, on the other hand, are expected
    // to produce output, and that output should be a 1:1 match between RONIN queries and
    // SQL statements, meaning one RONIN query should produce one main SQL statement.
    return [...dependencyStatements, ...mainStatements];
  };

  formatOutput(results: Array<Array<Row>>): Array<Result> {
    return results.map((result, index): Result => {
      const query = this.queries.at(-index) as Query;
      const { queryType, queryModel } = splitQuery(query);
      const model = getModelBySlug(this.models, queryModel);
      const single = queryModel !== model.pluralSlug;

      if (single) return { record: result[0] as NativeRecord };

      if (queryType === 'count') return { amount: result[0] as unknown as number };

      return { records: result as Array<NativeRecord> };
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
