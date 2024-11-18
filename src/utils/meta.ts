import type { Model, ModelIndex, PartialModel } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import { RONIN_MODEL_SYMBOLS } from '@/src/utils/helpers';

const PLURAL_SLUGS = {
  field: 'fields',
  index: 'indexes',
  trigger: 'triggers',
  preset: 'presets',
};

export const transformMetaQuery = (
  query: Query,
  models: Array<Model>,
  dependencyStatements?: Array<Statement>,
): Query => {
  if ('add' in query) {
    const details = query.add.model as PartialModel;

    return {
      create: {
        model: {
          to: details,
        },
      },
    };
  }

  if ('remove' in query) {
    const slug = query.remove.model as string;

    return {
      drop: {
        model: {
          with: { slug },
        },
      },
    };
  }

  if ('alter' in query) {
    const slug = query.alter.model as string;
    const action = Object.keys(query.alter).filter((key) => key !== 'model')[0] as
      | 'add'
      | 'remove';
    const type = Object.keys(query.alter[action])[0] as
      | 'field'
      | 'index'
      | 'trigger'
      | 'preset';
    const pluralType = PLURAL_SLUGS[type];

    const field = `${RONIN_MODEL_SYMBOLS.FIELD}${pluralType}`;

    let expression = '';

    if (action === 'add') {
      const item = query.alter[action][type] as Partial<ModelIndex>;

      const completeItem = { slug: item.slug || `${type}_slug`, ...item };
      const itemDetails = JSON.stringify(completeItem);

      expression = `json_insert(${field}, '$.${item.slug}', '${itemDetails}')`;

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

    const itemSlug = query.alter[action][type] as string;

    expression = `json_remove(${field}, '$.${itemSlug}')`;

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
