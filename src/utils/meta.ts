import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
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
    const options =
      'options' in query.alter ? (query.alter.options as PartialModel) : null;

    if (options) {
      // Compose default settings for the model.
      const modelWithFields = addDefaultModelFields(options, false);
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

    const action = Object.keys(query.alter).filter((key) => key !== 'model')[0] as
      | 'add'
      | 'alter'
      | 'remove';
    const type = Object.keys(query.alter[action])[0];

    if (action === 'add') {
      const item = query.alter[action][type] as Partial<ModelIndex>;
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

    if (action === 'alter') {
      const itemSlug = query.alter[action][type];
      const newItem = query.alter[action].options;

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

    const itemSlug = query.alter[action][type] as string;

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

  return query;
};
