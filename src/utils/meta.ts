import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { ModelEntity, Query, Statement } from '@/src/types/query';
import {
  addDefaultModelFields,
  addDefaultModelPresets,
  addModelQueries,
} from '@/src/utils/model';

export const transformMetaQuery = (
  models: Array<Model>,
  dependencyStatements: Array<Statement>,
  query: Query,
): Query => {
  if (query.add) {
    const init = query.add.model;
    const details =
      'options' in query.add
        ? ({ slug: init, ...query.add.options } as PartialModel)
        : (init as PartialModel);

    // Compose default settings for the model.
    const modelWithFields = addDefaultModelFields(details, true);
    const modelWithPresets = addDefaultModelPresets(models, modelWithFields);

    const instructions = {
      to: modelWithPresets,
    };

    addModelQueries(models, dependencyStatements, {
      queryType: 'create',
      queryModel: 'model',
      queryInstructions: instructions,
    });

    return {
      create: {
        model: instructions,
      },
    };
  }

  if (query.remove) {
    const slug = query.remove.model;

    const instructions = {
      with: { slug },
    };

    addModelQueries(models, dependencyStatements, {
      queryType: 'drop',
      queryModel: 'model',
      queryInstructions: instructions,
    });

    return {
      drop: {
        model: instructions,
      },
    };
  }

  if (query.alter) {
    const slug = query.alter.model;

    if ('options' in query.alter) {
      // Compose default settings for the model.
      const modelWithFields = addDefaultModelFields(query.alter.options, false);
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

    if ('add' in query.alter) {
      const type = Object.keys(query.alter.add)[0] as ModelEntity;
      const item = query.alter.add[type] as Partial<ModelIndex>;
      const completeItem = { slug: item.slug || `${type}_slug`, ...item };

      const instructions = {
        to: {
          model: { slug },
          ...completeItem,
        },
      };

      addModelQueries(models, dependencyStatements, {
        queryType: 'create',
        queryModel: type,
        queryInstructions: instructions,
      });

      return {
        create: {
          [type]: instructions,
        },
      };
    }

    if ('alter' in query.alter) {
      const type = Object.keys(query.alter.alter)[0] as ModelEntity;
      const itemSlug = query.alter.alter[type];
      const newItem = query.alter.alter.options;

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

    if ('remove' in query.alter) {
      const type = Object.keys(query.alter.remove)[0] as ModelEntity;
      const itemSlug = query.alter.remove[type] as string;

      const instructions = {
        with: { model: { slug }, slug: itemSlug },
      };

      addModelQueries(models, dependencyStatements, {
        queryType: 'drop',
        queryModel: type,
        queryInstructions: instructions,
      });

      return {
        drop: {
          [type]: instructions,
        },
      };
    }
  }

  return query;
};
