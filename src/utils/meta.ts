import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import {
  addDefaultModelFields,
  addDefaultModelPresets,
  addModelQueries,
} from '@/src/utils/model';

const ACTION_REGEX = /(?=[A-Z])/;

export const transformMetaQuery = (
  models: Array<Model>,
  dependencyStatements: Array<Statement>,
  query: Query,
): Query => {
  if ('addModel' in query) {
    const details = query.addModel as PartialModel;

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

  if ('removeModel' in query) {
    const slug = query.removeModel as string;

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

  if ('alterModel' in query) {
    const slug = query.alterModel as string;
    const fullAction = Object.keys(query).filter((key) => key !== 'alterModel')[0] as
      | 'addField'
      | 'alterField'
      | 'removeField'
      | 'addIndex'
      | 'removeIndex'
      | 'addTrigger'
      | 'removeTrigger'
      | 'to';

    if (fullAction === 'to') {
      // Compose default settings for the model.
      const modelWithFields = addDefaultModelFields(query.to, false);
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

    const [action, type] = fullAction
      .split(ACTION_REGEX)
      .map((part) => part.toLowerCase()) as [
      'add' | 'remove' | 'alter',
      'field' | 'index' | 'trigger',
    ];

    if (action === 'add') {
      const item = query[fullAction] as Partial<ModelIndex>;
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
      const [itemSlug, newItem] = query[fullAction] as [string, Partial<ModelIndex>];

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

    const itemSlug = query[fullAction] as string;

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
