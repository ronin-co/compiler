import type { ModelIndex, PartialModel } from '@/src/types/model';
import type { Query } from '@/src/types/query';

const ACTION_REGEX = /(?=[A-Z])/;

export const transformMetaQuery = (query: Query): Query => {
  if ('addModel' in query) {
    const details = query.addModel as PartialModel;

    return {
      create: {
        model: {
          to: details,
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
      | 'removeField'
      | 'addIndex'
      | 'removeIndex'
      | 'addTrigger'
      | 'removeTrigger';
    const [action, type] = fullAction
      .split(ACTION_REGEX)
      .map((part) => part.toLowerCase()) as [
      'add' | 'remove',
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
