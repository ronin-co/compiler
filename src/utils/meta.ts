import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { ModelEntity, Query, Statement } from '@/src/types/query';
import { RONIN_MODEL_SYMBOLS } from '@/src/utils/helpers';
import {
  addDefaultModelFields,
  addDefaultModelPresets,
  addModelQueries,
} from '@/src/utils/model';
import { prepareStatementValue } from '@/src/utils/statement';

const PLURAL_MODEL_ENTITIES: Record<ModelEntity, string> = {
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

    addModelQueries(models, dependencyStatements, {
      queryType: 'add',
      queryModel: 'model',
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

    addModelQueries(models, dependencyStatements, {
      queryType: 'remove',
      queryModel: 'model',
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

      addModelQueries(models, dependencyStatements, {
        queryType: 'set',
        queryModel: 'model',
        queryInstructions: instructions,
      });

      return {
        set: {
          model: instructions,
        },
      };
    }

    if ('create' in query.alter) {
      const type = Object.keys(query.alter.create)[0] as ModelEntity;
      const pluralType = PLURAL_MODEL_ENTITIES[type];

      const item = query.alter.create[type] as Partial<ModelIndex>;
      const completeItem = { slug: item.slug || `${type}_slug`, ...item };

      const instructions = {
        to: {
          model: { slug },
          ...completeItem,
        },
      };

      addModelQueries(models, dependencyStatements, {
        queryType: 'add',
        queryModel: type,
        queryInstructions: instructions,
      });

      const value = prepareStatementValue(statementParams, completeItem);
      const json = `json_insert(${RONIN_MODEL_SYMBOLS.FIELD}${pluralType}, '$.${completeItem.slug}', ${value})`;
      const expression = { [RONIN_MODEL_SYMBOLS.EXPRESSION]: json };

      return {
        set: {
          model: {
            with: { slug },
            to: {
              [pluralType]: expression,
            },
          },
        },
      };
    }

    if ('alter' in query.alter) {
      const type = Object.keys(query.alter.alter)[0] as ModelEntity;
      const itemSlug = query.alter.alter[type];
      const newItem = query.alter.alter.to;

      const instructions = {
        with: { model: { slug }, slug: itemSlug },
        to: newItem,
      };

      addModelQueries(models, dependencyStatements, {
        queryType: 'set',
        queryModel: type,
        queryInstructions: instructions,
      });

      return {
        set: {
          [type]: instructions,
        },
      };
    }

    const type = Object.keys(query.alter.drop)[0] as ModelEntity;
    const itemSlug = query.alter.drop[type] as string;

    const instructions = {
      with: { model: { slug }, slug: itemSlug },
    };

    addModelQueries(models, dependencyStatements, {
      queryType: 'remove',
      queryModel: type,
      queryInstructions: instructions,
    });

    return {
      remove: {
        [type]: instructions,
      },
    };
  }

  return query;
};
