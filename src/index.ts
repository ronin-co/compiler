import type { PublicModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import { compileQueryInput } from '@/src/utils';
import { transformMetaQuery } from '@/src/utils/meta';
import {
  addDefaultModelFields,
  addDefaultModelPresets,
  addSystemModels,
} from '@/src/utils/model';

/**
 * Composes SQL statements for the provided RONIN queries.
 *
 * @param queries - The RONIN queries for which SQL statements should be composed.
 * @param models - A list of models.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The composed SQL statements.
 */
export const compileQueries = (
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
    const transformedQuery = transformMetaQuery(query);

    const result = compileQueryInput(
      transformedQuery,
      modelListWithPresets,
      options?.inlineParams ? null : [],
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

// Expose model types
export type {
  PublicModel as Model,
  ModelField,
  ModelIndex,
  ModelTrigger,
} from '@/src/types/model';

// Expose query types
export type { Query, Statement } from '@/src/types/query';
