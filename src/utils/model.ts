import { handleWith } from '@/src/instructions/with';
import type {
  Model,
  ModelField,
  ModelFieldReferenceAction,
  ModelIndexField,
  ModelPreset,
  ModelTriggerField,
  PartialModel,
  PublicModel,
} from '@/src/types/model';
import type {
  Query,
  QueryInstructionType,
  QueryType,
  Statement,
  WithInstruction,
} from '@/src/types/query';
import {
  RONIN_MODEL_SYMBOLS,
  RoninError,
  convertToCamelCase,
  convertToSnakeCase,
  findInObject,
  type splitQuery,
} from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';
import { getSymbol, parseFieldExpression } from '@/src/utils/statement';
import title from 'title';

/**
 * Finds a model by its slug or plural slug.
 *
 * @param models - A list of models.
 * @param slug - The slug to search for.
 *
 * @returns A model for the provided slug or plural slug.
 */
export const getModelBySlug = <T extends Model | PublicModel>(
  models: Array<T>,
  slug: string,
): T => {
  const model = models.find((model) => {
    return model.slug === slug || model.pluralSlug === slug;
  });

  if (!model) {
    throw new RoninError({
      message: `No matching model with either Slug or Plural Slug of "${slug}" could be found.`,
      code: 'MODEL_NOT_FOUND',
    });
  }

  return model;
};

/**
 * Composes the slug of an associative model that is used to establish a relationship
 * between two models that are not directly related to each other.
 *
 * @param model - The model that contains the link field.
 * @param field - The link field that is being used to establish the relationship.
 *
 * @returns A slug for the associative model.
 */
export const composeAssociationModelSlug = (model: PublicModel, field: ModelField) =>
  convertToCamelCase(`ronin_link_${model.slug}_${field.slug}`);

/**
 * Constructs the SQL selector for a given field in a model.
 *
 * @param model - The model to which the field belongs.
 * @param field - A field from the model.
 * @param fieldPath - The path of the field being addressed. Supports dot notation for
 * accessing nested fields.
 * @param instructionName - The name of the query instruction that is being used.
 *
 * @returns The SQL column selector for the provided field.
 */
const getFieldSelector = (
  model: Model,
  field: ModelField,
  fieldPath: string,
  instructionName: QueryInstructionType,
) => {
  const symbol = model.tableAlias?.startsWith(RONIN_MODEL_SYMBOLS.FIELD_PARENT)
    ? `${model.tableAlias.replace(RONIN_MODEL_SYMBOLS.FIELD_PARENT, '').slice(0, -1)}.`
    : '';
  const tablePrefix = symbol || (model.tableAlias ? `"${model.tableAlias}".` : '');

  // If the field is of type JSON and the field is being selected in a read query, that
  // means we should extract the nested property from the JSON field.
  if (field.type === 'json' && instructionName !== 'to') {
    const dotParts = fieldPath.split('.');
    const columnName = tablePrefix + dotParts.shift();
    const jsonField = dotParts.join('.');

    return `json_extract(${columnName}, '$.${jsonField}')`;
  }

  return `${tablePrefix}"${fieldPath}"`;
};

/**
 * Obtains a field from a given model using its path.
 *
 * @param model - The model to retrieve the field from.
 * @param fieldPath - The path of the field to retrieve. Supports dot notation for
 * accessing nested fields.
 * @param instructionName - The name of the query instruction that is being used.
 *
 * @returns The requested field of the model, and its SQL selector.
 */
export const getFieldFromModel = (
  model: Model,
  fieldPath: string,
  instructionName: QueryInstructionType,
): { field: ModelField; fieldSelector: string } => {
  const errorPrefix = `Field "${fieldPath}" defined for \`${instructionName}\``;
  const modelFields = model.fields || [];

  let modelField: ModelField | undefined;

  // If the field being accessed is actually a nested property of a JSON field, return
  // that root JSON field.
  if (fieldPath.includes('.')) {
    modelField = modelFields.find((field) => field.slug === fieldPath.split('.')[0]);

    if (modelField?.type === 'json') {
      const fieldSelector = getFieldSelector(
        model,
        modelField,
        fieldPath,
        instructionName,
      );
      return { field: modelField, fieldSelector };
    }
  }

  modelField = modelFields.find((field) => field.slug === fieldPath);

  if (!modelField) {
    throw new RoninError({
      message: `${errorPrefix} does not exist in model "${model.name}".`,
      code: 'FIELD_NOT_FOUND',
      field: fieldPath,
      queries: null,
    });
  }

  const fieldSelector = getFieldSelector(model, modelField, fieldPath, instructionName);
  return { field: modelField, fieldSelector };
};

/**
 * Converts a slug to a readable name by splitting it on uppercase characters
 * and returning it formatted as title case.
 *
 * @example
 * ```ts
 * slugToName('activeAt'); // 'Active At'
 * ```
 *
 * @param slug - The slug string to convert.
 *
 * @returns The formatted name in title case.
 */
const slugToName = (slug: string) => {
  // Split the slug by uppercase letters and join with a space
  const name = slug.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Convert the resulting string to title case using the 'title' library
  return title(name);
};

const VOWELS = ['a', 'e', 'i', 'o', 'u'];

/**
 * Pluralizes a singular English noun according to basic English pluralization rules.
 *
 * This function handles the following cases:
 * - **Words ending with a consonant followed by 'y'**: Replaces the 'y' with 'ies'.
 * - **Words ending with 's', 'ch', 'sh', or 'ex'**: Adds 'es' to the end of the word.
 * - **All other words**: Adds 's' to the end of the word.
 *
 * @example
 * ```ts
 * pluralize('baby');    // 'babies'
 * pluralize('key');     // 'keys'
 * pluralize('bus');     // 'buses'
 * pluralize('church');  // 'churches'
 * pluralize('cat');     // 'cats'
 * ```
 *
 * @param word - The singular noun to pluralize.
 *
 * @returns The plural form of the input word.
 */
const pluralize = (word: string) => {
  const lastLetter = word.slice(-1).toLowerCase();
  const secondLastLetter = word.slice(-2, -1).toLowerCase();

  if (lastLetter === 'y' && !VOWELS.includes(secondLastLetter)) {
    // If the word ends with 'y' preceded by a consonant, replace 'y' with 'ies'
    return `${word.slice(0, -1)}ies`;
  }

  if (
    lastLetter === 's' ||
    word.slice(-2).toLowerCase() === 'ch' ||
    word.slice(-2).toLowerCase() === 'sh' ||
    word.slice(-2).toLowerCase() === 'ex'
  ) {
    // If the word ends with 's', 'ch', 'sh', or 'ex', add 'es'
    return `${word}es`;
  }

  // In all other cases, simply add 's'
  return `${word}s`;
};

type ComposableSettings =
  | 'slug'
  | 'pluralSlug'
  | 'name'
  | 'pluralName'
  | 'idPrefix'
  | 'table';

/**
 * A list of settings that can be automatically generated based on other settings.
 *
 * The first item in each tuple is the setting that should be generated, the second item
 * is the setting that should be used as a base, and the third item is the function that
 * should be used to generate the new setting.
 */
const modelSettings: Array<
  [ComposableSettings, ComposableSettings, (arg: string) => string]
> = [
  ['pluralSlug', 'slug', pluralize],
  ['name', 'slug', slugToName],
  ['pluralName', 'pluralSlug', slugToName],
  ['idPrefix', 'slug', (slug: string) => slug.slice(0, 3)],
  ['table', 'pluralSlug', convertToSnakeCase],
];

/**
 * Add a default name, plural name, and plural slug to a provided model.
 *
 * @param model - The model that should receive defaults.
 * @param isNew - Whether the model is being newly created.
 *
 * @returns The updated model.
 */
export const addDefaultModelFields = (model: PartialModel, isNew: boolean): Model => {
  const copiedModel = { ...model };

  for (const [setting, base, generator] of modelSettings) {
    // If a custom value was provided for the setting, or the setting from which the current
    // one can be generated is not available, skip the generation.
    if (copiedModel[setting] || !copiedModel[base]) continue;

    // Otherwise, if possible, generate the setting.
    copiedModel[setting] = generator(copiedModel[base]);
  }

  const newFields = copiedModel.fields || [];

  // If the model is being newly created or if new fields were provided for an existing
  // model, we would like to re-generate the list of `identifiers` and attach the system
  // fields to the model.
  if (isNew || newFields.length > 0) {
    if (!copiedModel.identifiers) copiedModel.identifiers = {};

    // Intelligently select a reasonable default for which field should be used as the
    // display name of the records in the model (e.g. used in lists on the dashboard).
    if (!copiedModel.identifiers.name) {
      const suitableField = newFields.find(
        (field) =>
          field.type === 'string' &&
          field.required === true &&
          ['name'].includes(field.slug),
      );

      copiedModel.identifiers.name = suitableField?.slug || 'id';
    }

    // Intelligently select a reasonable default for which field should be used as the
    // slug of the records in the model (e.g. used in URLs on the dashboard).
    if (!copiedModel.identifiers.slug) {
      const suitableField = newFields.find(
        (field) =>
          field.type === 'string' &&
          field.unique === true &&
          field.required === true &&
          ['slug', 'handle'].includes(field.slug),
      );

      copiedModel.identifiers.slug = suitableField?.slug || 'id';
    }

    copiedModel.fields = [...SYSTEM_FIELDS, ...newFields];
  }

  return copiedModel as Model;
};

/** These fields are required by the system and automatically added to every model. */
export const SYSTEM_FIELDS: Array<ModelField> = [
  {
    name: 'ID',
    type: 'string',
    slug: 'id',
    displayAs: 'single-line',
  },
  {
    name: 'RONIN',
    type: 'group',
    slug: 'ronin',
  },
  {
    name: 'RONIN - Locked',
    type: 'boolean',
    slug: 'ronin.locked',
  },
  {
    name: 'RONIN - Created At',
    type: 'date',
    slug: 'ronin.createdAt',
  },
  {
    name: 'RONIN - Created By',
    type: 'string',
    slug: 'ronin.createdBy',
  },
  {
    name: 'RONIN - Updated At',
    type: 'date',
    slug: 'ronin.updatedAt',
  },
  {
    name: 'RONIN - Updated By',
    type: 'string',
    slug: 'ronin.updatedBy',
  },
];

/** These models are required by the system and are automatically made available. */
const SYSTEM_MODELS: Array<Model> = [
  {
    slug: 'model',

    identifiers: {
      name: 'name',
      slug: 'slug',
    },

    fields: [
      { slug: 'name', type: 'string' },
      { slug: 'pluralName', type: 'string' },
      { slug: 'slug', type: 'string' },
      { slug: 'pluralSlug', type: 'string' },

      { slug: 'idPrefix', type: 'string' },
      { slug: 'table', type: 'string' },

      { slug: 'identifiers', type: 'group' },
      { slug: 'identifiers.name', type: 'string' },
      { slug: 'identifiers.slug', type: 'string' },

      { slug: 'fields', type: 'json' },
      { slug: 'indexes', type: 'json' },
      { slug: 'triggers', type: 'json' },
      { slug: 'presets', type: 'json' },
    ],
  },
  {
    slug: 'field',

    identifiers: {
      name: 'name',
      slug: 'slug',
    },

    fields: [
      { slug: 'name', type: 'string' },
      { slug: 'slug', type: 'string', required: true },
      { slug: 'type', type: 'string', required: true },
      {
        slug: 'model',
        type: 'link',
        target: 'model',
        required: true,
      },
      { slug: 'required', type: 'boolean' },
      { slug: 'defaultValue', type: 'string' },
      { slug: 'unique', type: 'boolean' },
      { slug: 'autoIncrement', type: 'boolean' },

      // Only allowed for fields of type "link".
      { slug: 'target', type: 'string' },
      { slug: 'kind', type: 'string' },
      { slug: 'actions', type: 'group' },
      { slug: 'actions.onDelete', type: 'string' },
      { slug: 'actions.onUpdate', type: 'string' },
    ],
  },
  {
    slug: 'index',

    identifiers: {
      name: 'slug',
      slug: 'slug',
    },

    fields: [
      { slug: 'slug', type: 'string', required: true },
      {
        slug: 'model',
        type: 'link',
        target: 'model',
        required: true,
      },
      { slug: 'unique', type: 'boolean' },
      { slug: 'filter', type: 'json' },
      { slug: 'fields', type: 'json', required: true },
    ],
  },
  {
    slug: 'trigger',

    identifiers: {
      name: 'slug',
      slug: 'slug',
    },

    fields: [
      { slug: 'slug', type: 'string', required: true },
      {
        slug: 'model',
        type: 'link',
        target: 'model',
        required: true,
      },
      { slug: 'when', type: 'string', required: true },
      { slug: 'action', type: 'string', required: true },
      { slug: 'filter', type: 'json' },
      { slug: 'effects', type: 'json', required: true },
      { slug: 'fields', type: 'json' },
    ],
  },
  {
    slug: 'preset',

    fields: [
      { slug: 'slug', type: 'string', required: true },
      {
        slug: 'model',
        type: 'link',
        target: 'model',
        required: true,
      },
      { slug: 'instructions', type: 'json', required: true },
    ],
  },
].map((model) => addDefaultModelFields(model as PublicModel, true));

/**
 * We are computing this at the root level in order to avoid computing it again with
 * every function call.
 */
const SYSTEM_MODEL_SLUGS = SYSTEM_MODELS.flatMap(({ slug, pluralSlug }) => [
  slug,
  pluralSlug,
]);

/**
 * Extends a list of models with automatically generated models that make writing
 * queries even easier.
 *
 * @param models - The list of models to extend.
 *
 * @returns The extended list of models.
 */
export const addSystemModels = (models: Array<PublicModel>): Array<PartialModel> => {
  const associativeModels = models.flatMap((model) => {
    const addedModels: Array<PartialModel> = [];

    for (const field of model.fields || []) {
      if (field.type === 'link' && !field.slug.startsWith('ronin.')) {
        const relatedModel = getModelBySlug(models, field.target);

        let fieldSlug = relatedModel.slug;

        // If a link field with the cardinality "many" is found, we would like to
        // initialize an invisible associative model, which is used to establish the
        // relationship between the source model and target model, even though those two
        // are not directly related to each other.
        if (field.kind === 'many') {
          fieldSlug = composeAssociationModelSlug(model, field);

          addedModels.push({
            pluralSlug: fieldSlug,
            slug: fieldSlug,
            associationSlug: field.slug,
            fields: [
              {
                slug: 'source',
                type: 'link',
                target: model.slug,
              },
              {
                slug: 'target',
                type: 'link',
                target: relatedModel.slug,
              },
            ],
          });
        }
      }
    }

    return addedModels;
  });

  return [...SYSTEM_MODELS, ...associativeModels, ...models];
};

/**
 * Adds useful default presets to a model, which can be used to write simpler queries.
 *
 * @param list - The list of all models.
 * @param model - The model for which default presets should be added.
 *
 * @returns The model with default presets added.
 */
export const addDefaultModelPresets = (list: Array<Model>, model: Model): Model => {
  const defaultPresets: Array<ModelPreset> = [];

  // Add default presets, which people can overwrite if they want to. Presets are
  // used to provide concise ways of writing advanced queries, by allowing for defining
  // complex queries inside the model definitions and re-using them across many
  // different queries in the codebase of an application.
  for (const field of model.fields || []) {
    if (field.type === 'link' && !field.slug.startsWith('ronin.')) {
      const relatedModel = getModelBySlug(list, field.target);

      // If a link field has the cardinality "many", we don't need to add a default
      // preset for resolving its records, because we are already adding an associative
      // schema in `addSystemModels`, which causes a default preset to get added in the
      // original schema anyways.
      if (field.kind === 'many') continue;

      // For every link field, add a default preset for resolving the linked record in
      // the model that contains the link field.
      defaultPresets.push({
        instructions: {
          including: {
            [field.slug]: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
                get: {
                  [relatedModel.slug]: {
                    with: {
                      // Compare the `id` field of the related model to the link field on
                      // the root model (`field.slug`).
                      id: {
                        [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT}${field.slug}`,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        slug: field.slug,
      });
    }
  }

  // Find potential child models that are referencing the current parent model. For
  // each of them, we then add a default preset for resolving the child records from the
  // parent model.
  const childModels = list
    .map((subModel) => {
      const field = subModel.fields?.find((field) => {
        return field.type === 'link' && field.target === model.slug;
      });

      if (!field) return null;
      return { model: subModel, field };
    })
    .filter((match) => match !== null);

  for (const childMatch of childModels) {
    const { model: childModel, field: childField } = childMatch;
    const pluralSlug = childModel.pluralSlug as string;

    const presetSlug = childModel.associationSlug || pluralSlug;

    defaultPresets.push({
      instructions: {
        including: {
          [presetSlug]: {
            [RONIN_MODEL_SYMBOLS.QUERY]: {
              get: {
                [pluralSlug]: {
                  with: {
                    [childField.slug]: {
                      [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT}id`,
                    },
                  },
                },
              },
            },
          },
        },
      },
      slug: presetSlug,
    });
  }

  if (Object.keys(defaultPresets).length > 0) {
    model.presets = [...defaultPresets, ...(model.presets || [])];
  }

  return model;
};

/** A union type of all query instructions, but without nested instructions. */
type QueryInstructionTypeClean = Exclude<
  QueryInstructionType,
  'orderedBy.ascending' | 'orderedBy.descending'
>;

/**
 * A list of RONIN query types and the respective query instruction from which values
 * should be read that are used for finding/targeting records.
 *
 * For example, the values used for targeting a record in a `set` query are placed in
 * the `with` instruction.
 */
const mappedInstructions: Partial<Record<QueryType, QueryInstructionTypeClean>> = {
  create: 'to',
  set: 'with',
  drop: 'with',
};

/** A list of all RONIN data types and their respective column types in SQLite. */
const typesInSQLite = {
  link: 'TEXT',
  string: 'TEXT',
  date: 'DATETIME',
  blob: 'TEXT',
  boolean: 'BOOLEAN',
  number: 'INTEGER',
  json: 'TEXT',
};

/**
 * Composes the SQL syntax for a field in a RONIN model.
 *
 * @param models - A list of models.
 * @param model - The model that contains the field.
 * @param field - The field of a RONIN model.
 *
 * @returns The SQL syntax for the provided field.
 */
const getFieldStatement = (
  models: Array<Model>,
  model: Model,
  field: ModelField,
): string | null => {
  if (field.type === 'group') return null;

  let statement = `"${field.slug}" ${typesInSQLite[field.type]}`;

  if (field.slug === 'id') statement += ' PRIMARY KEY';
  if (field.unique === true) statement += ' UNIQUE';
  if (field.required === true) statement += ' NOT NULL';
  if (typeof field.defaultValue !== 'undefined')
    statement += ` DEFAULT ${field.defaultValue}`;
  if (field.collation) statement += ` COLLATE ${field.collation}`;
  if (field.increment === true) statement += ' AUTOINCREMENT';

  if (typeof field.check !== 'undefined') {
    const symbol = getSymbol(field.check);
    statement += ` CHECK (${parseFieldExpression(model, 'to', symbol?.value as string)})`;
  }

  if (typeof field.computedAs !== 'undefined') {
    const { kind, value } = field.computedAs;
    const symbol = getSymbol(value);
    statement += ` GENERATED ALWAYS AS (${parseFieldExpression(model, 'to', symbol?.value as string)}) ${kind}`;
  }

  if (field.type === 'link') {
    const actions = field.actions || {};
    const targetTable = getModelBySlug(models, field.target).table;

    statement += ` REFERENCES ${targetTable}("id")`;

    for (const trigger in actions) {
      const triggerName = trigger.toUpperCase().slice(2);
      const action = actions[
        trigger as keyof typeof actions
      ] as ModelFieldReferenceAction;

      statement += ` ON ${triggerName} ${action}`;
    }
  }

  return statement;
};

/**
 * Generates the necessary SQL dependency statements for queries such as `create.model`,
 * which are used to create, update, or delete models and fields. The generated
 * dependency statements are used to alter the SQLite database model.
 *
 * @param models - A list of models.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param queryDetails - The parsed details of the query that is being executed.
 *
 * @returns The (possibly modified) query instructions.
 */
export const addModelQueries = (
  models: Array<Model>,
  dependencyStatements: Array<Statement>,
  queryDetails: ReturnType<typeof splitQuery>,
) => {
  const { queryType, queryModel, queryInstructions } = queryDetails;

  // Only continue if the query is a write query.
  if (!['create', 'set', 'drop'].includes(queryType)) return;

  // Only continue if the query addresses system models.
  if (!SYSTEM_MODEL_SLUGS.includes(queryModel)) return;

  const instructionName = mappedInstructions[queryType] as QueryInstructionTypeClean;
  const instructionList = queryInstructions[instructionName] as WithInstruction;

  // Whether models or fields are being updated.
  const kind = getModelBySlug(SYSTEM_MODELS, queryModel).pluralSlug;

  let tableAction = 'ALTER';
  let queryTypeReadable: string | null = null;

  switch (queryType) {
    case 'create': {
      if (kind === 'models' || kind === 'indexes' || kind === 'triggers') {
        tableAction = 'CREATE';
      }
      queryTypeReadable = 'creating';
      break;
    }

    case 'set': {
      if (kind === 'models') tableAction = 'ALTER';
      queryTypeReadable = 'updating';
      break;
    }

    case 'drop': {
      if (kind === 'models' || kind === 'indexes' || kind === 'triggers') {
        tableAction = 'DROP';
      }
      queryTypeReadable = 'deleting';
      break;
    }
  }

  const slug: string = instructionList?.slug?.being || instructionList?.slug;

  const modelInstruction = instructionList?.model;
  const modelSlug = modelInstruction?.slug?.being || modelInstruction?.slug;

  const usableSlug = kind === 'models' ? slug : modelSlug;
  const tableName = convertToSnakeCase(pluralize(usableSlug));
  const targetModel =
    kind === 'models' && queryType === 'create'
      ? null
      : getModelBySlug(models, usableSlug);

  if (kind === 'indexes') {
    const indexName = convertToSnakeCase(slug);

    // Whether the index should only allow one record with a unique value for its fields.
    const unique: boolean | undefined = instructionList?.unique;

    // The query instructions that should be used to filter the indexed records.
    const filterQuery: WithInstruction = instructionList?.filter;

    // The specific fields that should be indexed.
    const fields: Array<ModelIndexField> = instructionList?.fields;

    const params: Array<unknown> = [];
    let statement = `${tableAction}${unique ? ' UNIQUE' : ''} INDEX "${indexName}"`;

    if (queryType === 'create') {
      const model = targetModel as Model;
      const columns = fields.map((field) => {
        let fieldSelector = '';

        // If the slug of a field is provided, find the field in the model, obtain its
        // column selector, and place it in the SQL statement.
        if ('slug' in field) {
          ({ fieldSelector } = getFieldFromModel(model, field.slug, 'to'));
        }
        // Alternatively, if an expression is provided instead of the slug of a field,
        // find all fields inside the expression, obtain their column selectors, and
        // insert them into the expression, after which the expression can be used in the
        // SQL statement.
        else if ('expression' in field) {
          fieldSelector = parseFieldExpression(model, 'to', field.expression, model);
        }

        if (field.collation) fieldSelector += ` COLLATE ${field.collation}`;
        if (field.order) fieldSelector += ` ${field.order}`;

        return fieldSelector;
      });

      statement += ` ON "${tableName}" (${columns.join(', ')})`;

      // If filtering instructions were defined, add them to the index. Those
      // instructions will determine which records are included as part of the index.
      if (filterQuery) {
        const withStatement = handleWith(
          models,
          targetModel as Model,
          params,
          filterQuery,
        );
        statement += ` WHERE (${withStatement})`;
      }
    }

    dependencyStatements.push({ statement, params });
    return;
  }

  if (kind === 'triggers') {
    const triggerName = convertToSnakeCase(slug);

    const params: Array<unknown> = [];
    let statement = `${tableAction} TRIGGER "${triggerName}"`;

    if (queryType === 'create') {
      const currentModel = targetModel as Model;

      // When the trigger should fire and what type of query should cause it to fire.
      const { when, action } = instructionList;

      // The different parts of the final statement.
      const statementParts: Array<string> = [`${when} ${action}`];

      // The query that will be executed when the trigger is fired.
      const effectQueries: Array<Query> = instructionList?.effects;

      // The query instructions that are used to determine whether the trigger should be
      // fired, or not.
      const filterQuery: WithInstruction = instructionList?.filter;

      // The specific fields that should be targeted by the trigger. If those fields have
      // changed, the trigger will be fired.
      const fields: Array<ModelTriggerField> | undefined = instructionList?.fields;

      if (fields) {
        if (action !== 'UPDATE') {
          throw new RoninError({
            message: `When ${queryTypeReadable} ${kind}, targeting specific fields requires the \`UPDATE\` action.`,
            code: 'INVALID_MODEL_VALUE',
            fields: ['action'],
          });
        }

        const fieldSelectors = fields.map((field) => {
          return getFieldFromModel(currentModel, field.slug, 'to').fieldSelector;
        });

        statementParts.push(`OF (${fieldSelectors.join(', ')})`);
      }

      statementParts.push('ON', `"${tableName}"`);

      // If filtering instructions were defined, or if the effect query references
      // specific record fields, that means the trigger must be executed on a per-record
      // basis, meaning "for each row", instead of on a per-query basis.
      if (
        filterQuery ||
        effectQueries.some((query) => findInObject(query, RONIN_MODEL_SYMBOLS.FIELD))
      ) {
        statementParts.push('FOR EACH ROW');
      }

      // If filtering instructions were defined, add them to the trigger. Those
      // instructions will be validated for every row, and only if they match, the trigger
      // will then be fired.
      if (filterQuery) {
        const tableAlias =
          action === 'DELETE'
            ? RONIN_MODEL_SYMBOLS.FIELD_PARENT_OLD
            : RONIN_MODEL_SYMBOLS.FIELD_PARENT_NEW;

        const withStatement = handleWith(
          models,
          { ...currentModel, tableAlias: tableAlias },
          params,
          filterQuery,
        );

        statementParts.push('WHEN', `(${withStatement})`);
      }

      // Compile the effect queries into SQL statements.
      const effectStatements = effectQueries.map((effectQuery) => {
        return compileQueryInput(effectQuery, models, params, {
          returning: false,
          parentModel: currentModel,
        }).main.statement;
      });

      if (effectStatements.length > 1) statementParts.push('BEGIN');
      statementParts.push(effectStatements.join('; '));
      if (effectStatements.length > 1) statementParts.push('END');

      statement += ` ${statementParts.join(' ')}`;
    }

    dependencyStatements.push({ statement, params });
    return;
  }

  const statement = `${tableAction} TABLE "${tableName}"`;

  if (kind === 'models') {
    if (queryType === 'create') {
      const newModel = queryInstructions.to as Model;
      const { fields } = newModel;
      const columns = fields
        .map((field) => getFieldStatement(models, newModel, field))
        .filter(Boolean);

      dependencyStatements.push({
        statement: `${statement} (${columns.join(', ')})`,
        params: [],
      });

      // Add the newly created model to the list of models.
      models.push(newModel);
    } else if (queryType === 'set') {
      const newSlug = queryInstructions.to?.pluralSlug;

      if (newSlug) {
        const newTable = convertToSnakeCase(newSlug);

        // Only push the statement if the table name is changing, otherwise we don't
        // need it.
        dependencyStatements.push({
          statement: `${statement} RENAME TO "${newTable}"`,
          params: [],
        });
      }

      // Update the existing model in the list of models.
      Object.assign(targetModel as Model, queryInstructions.to);
    } else if (queryType === 'drop') {
      // Remove the model from the list of models.
      models.splice(models.indexOf(targetModel as Model), 1);

      dependencyStatements.push({ statement, params: [] });
    }

    return;
  }

  if (kind === 'fields') {
    if (queryType === 'create') {
      if (!instructionList.type) {
        throw new RoninError({
          message: `When ${queryTypeReadable} fields, a \`type\` field must be provided in the \`to\` instruction.`,
          code: 'MISSING_FIELD',
          fields: ['type'],
        });
      }

      dependencyStatements.push({
        statement: `${statement} ADD COLUMN ${getFieldStatement(models, targetModel as Model, instructionList as ModelField)}`,
        params: [],
      });
    } else if (queryType === 'set') {
      const newSlug = queryInstructions.to?.slug;

      if (newSlug) {
        // Only push the statement if the column name is changing, otherwise we don't
        // need it.
        dependencyStatements.push({
          statement: `${statement} RENAME COLUMN "${slug}" TO "${newSlug}"`,
          params: [],
        });
      }
    } else if (queryType === 'drop') {
      dependencyStatements.push({
        statement: `${statement} DROP COLUMN "${slug}"`,
        params: [],
      });
    }
  }
};
