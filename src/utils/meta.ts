import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { ModelEntity, ModelQueryType, Query, Statement } from '@/src/types/query';
import { RONIN_MODEL_SYMBOLS } from '@/src/utils/helpers';
import {
  addDefaultModelFields,
  addDefaultModelPresets,
  addModelStatements,
} from '@/src/utils/model';
import { prepareStatementValue } from '@/src/utils/statement';

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

    // Compose default settings for the model.
    const modelWithFields = addDefaultModelFields(details, true);
    const modelWithPresets = addDefaultModelPresets(models, modelWithFields);

    const instructions = {
      to: modelWithPresets,
    };

    addModelStatements(models, dependencyStatements, 'create', 'model', {
      queryInstructions: instructions,
    });

    return {
      add: {
        model: instructions,
      },
    };
  }

  if (query.drop) {
    const slug = query.drop.model;

    const instructions = {
      with: { slug },
    };

    addModelStatements(models, dependencyStatements, 'drop', 'model', {
      queryInstructions: instructions,
    });

    return {
      remove: {
        model: instructions,
      },
    };
  }

  if (query.alter) {
    const slug = query.alter.model;

    if ('to' in query.alter) {
      // Compose default settings for the model.
      const modelWithFields = addDefaultModelFields(query.alter.to, false);
      const modelWithPresets = addDefaultModelPresets(models, modelWithFields);

      const instructions = {
        with: { slug },
        to: modelWithPresets,
      };

      addModelStatements(models, dependencyStatements, 'alter', 'model', {
        queryInstructions: instructions,
      });

      return {
        set: {
          model: instructions,
        },
      };
    }

    const action = Object.keys(query.alter).filter(
      (key) => key !== 'model',
    )[0] as ModelQueryType;
    const details = (
      query.alter as unknown as Record<ModelQueryType, Record<ModelEntity, string>>
    )[action];
    const type = Object.keys(details)[0] as ModelEntity;

    let jsonAction: string | undefined;
    let jsonSlug: string = details[type];
    let jsonValue: unknown | undefined;

    const pluralType = PLURAL_MODEL_ENTITIES[type];

    if ('create' in query.alter) {
      const item = query.alter.create[type] as Partial<ModelIndex>;

      jsonSlug = item.slug || `${type}Slug`;
      jsonValue = { slug: item.slug || `${type}Slug`, ...item };
      jsonAction = 'insert';

      addModelStatements(models, dependencyStatements, action, type, {
        queryInstructions: {
          to: {
            model: { slug },
            ...(jsonValue as object),
          },
        },
      });
    }

    if ('alter' in query.alter) {
      jsonValue = query.alter.alter.to;
      jsonAction = 'patch';

      addModelStatements(models, dependencyStatements, action, type, {
        queryInstructions: {
          with: { model: { slug }, slug: jsonSlug },
          to: jsonValue as object,
        },
      });
    }

    if ('drop' in query.alter) {
      jsonAction = 'remove';

      addModelStatements(models, dependencyStatements, action, type, {
        queryInstructions: {
          with: { model: { slug }, slug: jsonSlug },
        },
      });
    }

    let json = `json_${jsonAction}(${RONIN_MODEL_SYMBOLS.FIELD}${pluralType}, '$.${jsonSlug}'`;
    if (jsonValue) json += `, ${prepareStatementValue(statementParams, jsonValue)}`;
    json += ')';

    return {
      set: {
        model: {
          with: { slug },
          to: {
            [pluralType]: { [RONIN_MODEL_SYMBOLS.EXPRESSION]: json },
          },
        },
      },
    };
  }

  return query;
};
