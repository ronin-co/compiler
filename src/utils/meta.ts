import type { Model } from '@/src/types/model';
import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { Query } from '@/src/types/query';
import { addDefaultModelFields, addDefaultModelPresets } from '@/src/utils/model';

const ACTION_REGEX = /(?=[A-Z])/;

export const transformMetaQuery = (models: Array<Model>, query: Query): Query => {
  if ('addModel' in query) {
    const details = query.addModel as PartialModel;

    // Compose default settings for the model.
    const modelWithFields = addDefaultModelFields(details, true);
    const modelWithPresets = addDefaultModelPresets(models, modelWithFields);

    return {
      create: {
        model: {
          to: modelWithPresets,
        },
      },
    };
  }

  if ('removeModel' in query) {
    const slug = query.removeModel as string;

    return {
      drop: {
        model: {
          with: { slug },
        },
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

      return {
        set: {
          model: {
            with: { slug },
            to: modelWithPresets,
          },
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

      return {
        create: {
          [type]: {
            to: {
              model: { slug },
              ...completeItem,
            },
          },
        },
      };
    }

    if (action === 'alter') {
      const [itemSlug, newItem] = query[fullAction] as [string, Partial<ModelIndex>];

      return {
        set: {
          [type]: {
            with: { model: { slug }, slug: itemSlug },
            to: newItem,
          },
        },
      };
    }

    const itemSlug = query[fullAction] as string;

    return {
      drop: {
        [type]: {
          with: { model: { slug }, slug: itemSlug },
        },
      },
    };
  }

  return query;
};
