import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { ModelEntity, ModelQueryType, Query, Statement } from '@/src/types/query';
import { addModelStatements } from '@/src/utils/model';

// Keeping these hardcoded instead of using `pluralize` is faster.
export const PLURAL_MODEL_ENTITIES: Record<ModelEntity, string> = {
  field: 'fields',
  index: 'indexes',
  trigger: 'triggers',
  preset: 'presets',
};

/**
 * Handles queries that modify the DB schema. Specifically, those are `create.model`,
 * `alter.model`, and `drop.model` queries.
 *
 * @param models - A list of models.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param query - The query that should potentially be transformed.
 *
 * @returns The transformed query.
 */
export const transformMetaQuery = (
  models: Array<Model>,
  dependencyStatements: Array<Statement>,
  statementParams: Array<unknown> | null,
  query: Query,
): Query => {
  if (query.create) {
    const init = query.create.model;
    const details =
      'to' in query.create
        ? ({ slug: init, ...query.create.to } as PartialModel)
        : (init as PartialModel);

    return addModelStatements(
      models,
      dependencyStatements,
      statementParams,
      'create',
      'model',
      {
        queryInstructions: {
          to: details,
        },
      },
    );
  }

  if (query.drop) {
    return addModelStatements(
      models,
      dependencyStatements,
      statementParams,
      'drop',
      'model',
      {
        queryInstructions: {
          with: { slug: query.drop.model },
        },
      },
    );
  }

  if (query.alter) {
    const slug = query.alter.model;

    if ('to' in query.alter) {
      return addModelStatements(
        models,
        dependencyStatements,
        statementParams,
        'alter',
        'model',
        {
          queryInstructions: {
            with: { slug },
            to: query.alter.to,
          },
        },
      );
    }

    const action = Object.keys(query.alter).filter(
      (key) => key !== 'model',
    )[0] as ModelQueryType;
    const details = (
      query.alter as unknown as Record<ModelQueryType, Record<ModelEntity, string>>
    )[action];
    const type = Object.keys(details)[0] as ModelEntity;

    let jsonSlug: string = details[type];
    let jsonValue: unknown | undefined;

    if ('create' in query.alter) {
      const item = query.alter.create[type] as Partial<ModelIndex>;

      jsonSlug = item.slug || `${type}Slug`;
      jsonValue = { slug: item.slug || `${type}Slug`, ...item };

      return addModelStatements(
        models,
        dependencyStatements,
        statementParams,
        action,
        type,
        {
          queryInstructions: {
            to: {
              model: { slug },
              ...(jsonValue as object),
            },
          },
        },
      );
    }

    if ('alter' in query.alter) {
      jsonValue = query.alter.alter.to;

      return addModelStatements(
        models,
        dependencyStatements,
        statementParams,
        action,
        type,
        {
          queryInstructions: {
            with: { model: { slug }, slug: jsonSlug },
            to: jsonValue as object,
          },
        },
      );
    }

    if ('drop' in query.alter) {
      return addModelStatements(
        models,
        dependencyStatements,
        statementParams,
        action,
        type,
        {
          queryInstructions: {
            with: { model: { slug }, slug: jsonSlug },
          },
        },
      );
    }
  }

  return query;
};
