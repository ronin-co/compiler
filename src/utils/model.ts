import { handleWith } from '@/src/instructions/with';
import type {
  Model,
  ModelEntity,
  ModelField,
  ModelFieldReferenceAction,
  ModelIndex,
  ModelPreset,
  ModelTrigger,
  PartialModel,
  PublicModel,
} from '@/src/types/model';
import type {
  ModelEntityType,
  ModelQueryType,
  Query,
  QueryInstructionType,
  Statement,
} from '@/src/types/query';
import {
  MODEL_ENTITY_ERROR_CODES,
  QUERY_SYMBOLS,
  RoninError,
  convertToCamelCase,
  convertToSnakeCase,
  findInObject,
  getSymbol,
  splitQuery,
} from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';
import { parseFieldExpression, prepareStatementValue } from '@/src/utils/statement';
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
  const symbol = model.tableAlias?.startsWith(QUERY_SYMBOLS.FIELD_PARENT)
    ? `${model.tableAlias.replace(QUERY_SYMBOLS.FIELD_PARENT, '').slice(0, -1)}.`
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

export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  instructionName: QueryInstructionType,
  shouldThrow?: true,
): { field: ModelField; fieldSelector: string };

export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  instructionName: QueryInstructionType,
  shouldThrow?: false,
): { field: ModelField; fieldSelector: string } | null;

export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  instructionName: QueryInstructionType,
  shouldThrow: boolean,
): { field: ModelField; fieldSelector: string } | null;

/**
 * Obtains a field from a given model using its path.
 *
 * @param model - The model to retrieve the field from.
 * @param fieldPath - The path of the field to retrieve. Supports dot notation for
 * accessing nested fields.
 * @param instructionName - The name of the query instruction that is being used.
 * @param shouldThrow - Whether to throw an error if the field is not found.
 *
 * @returns The requested field of the model, and its SQL selector.
 */
export function getFieldFromModel(
  model: Model,
  fieldPath: string,
  instructionName: QueryInstructionType,
  shouldThrow = true,
): { field: ModelField; fieldSelector: string } | null {
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
    if (shouldThrow) {
      throw new RoninError({
        message: `${errorPrefix} does not exist in model "${model.name}".`,
        code: 'FIELD_NOT_FOUND',
        field: fieldPath,
        queries: null,
      });
    }

    return null;
  }

  const fieldSelector = getFieldSelector(model, modelField, fieldPath, instructionName);
  return { field: modelField, fieldSelector };
}

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

/**
 * This model defines the architecture of the `ronin_schema` table, which is RONIN's
 * equivalent to the native `sqlite_schema` table provided by SQLite.
 */
export const ROOT_MODEL: PartialModel = {
  slug: 'model',

  identifiers: {
    name: 'name',
    slug: 'slug',
  },

  // This name mimics the `sqlite_schema` table in SQLite.
  table: 'ronin_schema',

  // Indicates that the model was automatically generated by RONIN.
  system: { model: 'root' },

  fields: [
    { slug: 'name', type: 'string' },
    { slug: 'pluralName', type: 'string' },
    { slug: 'slug', type: 'string' },
    { slug: 'pluralSlug', type: 'string' },

    { slug: 'idPrefix', type: 'string' },
    { slug: 'table', type: 'string' },

    { slug: 'identifiers.name', type: 'string' },
    { slug: 'identifiers.slug', type: 'string' },

    // Providing an empty object as a default value allows us to use `json_insert`
    // without needing to fall back to an empty object in the insertion statement,
    // which makes the statement shorter.
    { slug: 'fields', type: 'json', defaultValue: '{}' },
    { slug: 'indexes', type: 'json', defaultValue: '{}' },
    { slug: 'triggers', type: 'json', defaultValue: '{}' },
    { slug: 'presets', type: 'json', defaultValue: '{}' },
  ],
};

/**
 * Composes a list of potential system models that might be required for a manually
 * provided model.
 *
 * @param list - The list of all models.
 * @param model - The model for which system models should be generated.
 *
 * @returns The list of system models.
 */
export const getSystemModels = (
  models: Array<PublicModel>,
  model: PublicModel,
): Array<PartialModel> => {
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
          system: {
            model: model.slug,
            associationSlug: field.slug,
          },
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
      // schema in `getSystemModels`, which causes a default preset to get added in the
      // original schema anyways.
      if (field.kind === 'many') continue;

      // For every link field, add a default preset for resolving the linked record in
      // the model that contains the link field.
      defaultPresets.push({
        instructions: {
          including: {
            [field.slug]: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  [relatedModel.slug]: {
                    with: {
                      // Compare the `id` field of the related model to the link field on
                      // the root model (`field.slug`).
                      id: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}${field.slug}`,
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

    const presetSlug = childModel.system?.associationSlug || pluralSlug;

    defaultPresets.push({
      instructions: {
        including: {
          [presetSlug]: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                [pluralSlug]: {
                  with: {
                    [childField.slug]: {
                      [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
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
 * @returns The SQL syntax for the provided field, or `null` if none should be generated.
 */
const getFieldStatement = (
  models: Array<Model>,
  model: Model,
  field: ModelField,
): string | null => {
  let statement = `"${field.slug}" ${typesInSQLite[field.type]}`;

  if (field.slug === 'id') statement += ' PRIMARY KEY';
  if (field.unique === true) statement += ' UNIQUE';
  if (field.required === true) statement += ' NOT NULL';
  if (typeof field.defaultValue !== 'undefined')
    statement += ` DEFAULT ${typeof field.defaultValue === 'string' ? `'${field.defaultValue}'` : field.defaultValue}`;
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
    // Link fields with the cardinality "many" do not exist as columns in the database.
    // Instead, they are added in the output transformation of the compiler.
    if (field.kind === 'many') return null;

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

// Keeping these hardcoded instead of using `pluralize` is faster.
const PLURAL_MODEL_ENTITIES = {
  field: 'fields',
  index: 'indexes',
  trigger: 'triggers',
  preset: 'presets',
} as const;

/**
 * Converts an array of model entites (such as fields) to an object where the keys are
 * the slugs of the entities and the values are their attributes.
 *
 * @param type The type of model entity to be processed.
 * @param entities The list of the actual entities.
 *
 * @returns An object composed of the provided model entities.
 */
const formatModelEntity = (type: ModelEntityType, entities?: Array<ModelEntity>) => {
  const entries = entities?.map((entity) => {
    const { slug, ...rest } =
      'slug' in entity ? entity : { slug: `${type}Slug`, ...entity };
    return [slug, rest];
  });

  return entries ? Object.fromEntries(entries) : undefined;
};

/**
 * Composes an SQL statement for creating, altering, or dropping a system model.
 *
 * @param models - A list of models.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param action - Whether the system model should be created, altered, or dropped.
 * @param systemModel - The affected system model.
 *
 * @returns Nothing. The `models` and `dependencyStatements` arrays are modified in place.
 */
const handleSystemModel = (
  models: Array<Model>,
  dependencyStatements: Array<Statement>,
  action: 'create' | 'alter' | 'drop',
  systemModel: PartialModel,
  newModel?: PartialModel,
) => {
  // Omit the `system` property.
  const { system: _, ...systemModelClean } = systemModel;

  const query: Query = {
    [action]: { model: action === 'create' ? systemModelClean : systemModelClean.slug },
  };

  if (action === 'alter' && newModel) {
    const { system: _, ...newModelClean } = newModel;
    (query.alter as Query & { to: PartialModel }).to = newModelClean;
  }

  const statement = compileQueryInput(query, models, []);

  dependencyStatements.push(...statement.dependencies);
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
 * @returns The transformed query or `null` if no further query processing should happen.
 */
export const transformMetaQuery = (
  models: Array<Model>,
  dependencyStatements: Array<Statement>,
  statementParams: Array<unknown> | null,
  query: Query,
): Query | null => {
  const { queryType } = splitQuery(query);
  const subAltering = query.alter && !('to' in query.alter);

  const action =
    subAltering && query.alter
      ? (Object.keys(query.alter).filter((key) => key !== 'model')[0] as ModelQueryType)
      : (queryType as ModelQueryType);

  const actionReadable =
    action === 'create' ? 'creating' : action === 'alter' ? 'altering' : 'dropping';

  const entity = (
    subAltering && query.alter
      ? Object.keys((query.alter as unknown as Record<ModelQueryType, string>)[action])[0]
      : 'model'
  ) as ModelEntityType | 'model';

  let slug =
    entity === 'model' && action === 'create'
      ? null
      : (query[queryType]!.model as string);
  let modelSlug = slug;

  let jsonValue: Record<string, unknown> | undefined;

  if (query.create) {
    const init = query.create.model;
    jsonValue =
      'to' in query.create
        ? ({ slug: init, ...query.create.to } as PartialModel)
        : (init as PartialModel);

    slug = modelSlug = jsonValue.slug as string;
  }

  if (query.alter) {
    if ('to' in query.alter) {
      jsonValue = query.alter.to;
    } else {
      slug = (
        query.alter as unknown as Record<ModelQueryType, Record<ModelEntityType, string>>
      )[action][entity as ModelEntityType];

      if ('create' in query.alter) {
        const item = (
          query.alter.create as unknown as Record<ModelEntityType, ModelIndex>
        )[entity as ModelEntityType] as Partial<ModelIndex>;

        slug = item.slug || `${entity}Slug`;
        jsonValue = { slug, ...item };
      }

      if ('alter' in query.alter) jsonValue = query.alter.alter.to;
    }
  }

  if (!(modelSlug && slug)) return query;

  const model =
    action === 'create' && entity === 'model' ? null : getModelBySlug(models, modelSlug);

  if (entity === 'model') {
    let queryTypeDetails: { to?: PartialModel } | { with?: PartialModel } = {};

    if (action === 'create') {
      const newModel = jsonValue as unknown as Model;

      // Compose default settings for the model.
      const modelWithFields = addDefaultModelFields(newModel, true);
      const modelWithPresets = addDefaultModelPresets(
        [...models, modelWithFields],
        modelWithFields,
      );

      // A list of all model entities, in the form of an object.
      const entities = Object.fromEntries(
        Object.entries(PLURAL_MODEL_ENTITIES).map(([type, pluralType]) => {
          const list = modelWithPresets[pluralType as keyof Model] as
            | Array<ModelEntity>
            | undefined;
          return [pluralType, formatModelEntity(type as ModelEntityType, list)];
        }),
      );

      const columns = modelWithPresets.fields
        .map((field) => getFieldStatement(models, modelWithPresets, field))
        .filter(Boolean);

      dependencyStatements.push({
        statement: `CREATE TABLE "${modelWithPresets.table}" (${columns.join(', ')})`,
        params: [],
      });

      // Add the newly created model to the list of models.
      models.push(modelWithPresets);

      const finalModel = Object.assign({}, modelWithPresets);

      for (const entity in entities) {
        if (entities[entity]) finalModel[entity as keyof Model] = entities[entity];
      }

      queryTypeDetails = { to: finalModel };

      // Add any system models that might be needed by the model.
      getSystemModels(models, modelWithPresets).map((systemModel) => {
        // Compose the SQL statement for adding the system model.
        // This modifies the original `models` array and adds the system model to it.
        return handleSystemModel(models, dependencyStatements, 'create', systemModel);
      });
    }

    if (action === 'alter' && model) {
      const newModel = jsonValue as unknown as Model;

      // Compose default settings for the model.
      const modelWithFields = addDefaultModelFields(newModel, false);
      const modelWithPresets = addDefaultModelPresets(models, modelWithFields);

      const newTableName = modelWithPresets.table;

      // Only push the statement if the table name changed, otherwise we don't need it.
      if (newTableName) {
        dependencyStatements.push({
          statement: `ALTER TABLE "${model.table}" RENAME TO "${newTableName}"`,
          params: [],
        });
      }

      // Update the existing model in the list of models.
      Object.assign(model, modelWithPresets);

      queryTypeDetails = {
        with: {
          slug,
        },
        to: modelWithPresets,
      };
    }

    if (action === 'drop' && model) {
      // Remove the model from the list of models.
      models.splice(models.indexOf(model), 1);

      dependencyStatements.push({ statement: `DROP TABLE "${model.table}"`, params: [] });

      queryTypeDetails = { with: { slug } };

      // Remove all system models that are associated with the model.
      models
        .filter(({ system }) => system?.model === model.slug)
        .map((systemModel) => {
          // Compose the SQL statement for removing the system model.
          // This modifies the original `models` array and removes the system model from it.
          return handleSystemModel(models, dependencyStatements, 'drop', systemModel);
        });
    }

    const modelSlug =
      'to' in queryTypeDetails
        ? queryTypeDetails?.to?.slug
        : 'with' in queryTypeDetails
          ? queryTypeDetails?.with?.slug
          : undefined;

    // If the root model is being created or dropped, altering the `ronin_schema` table
    // is not necessary, since that table is created precisely for that model.
    if (modelSlug === 'model') return null;

    const queryTypeAction =
      action === 'create' ? 'add' : action === 'alter' ? 'set' : 'remove';

    return {
      [queryTypeAction]: {
        model: queryTypeDetails,
      },
    };
  }

  // Entities can only be created, altered, or dropped on existing models, so the model
  // is guaranteed to exist.
  const modelBeforeUpdate = structuredClone(model);
  const existingModel = model as Model;

  const pluralType = PLURAL_MODEL_ENTITIES[entity];

  const targetEntityIndex = existingModel[pluralType]?.findIndex(
    (entity) => entity.slug === slug,
  );

  // Throw an error if the entity that was targeted is not available in the model.
  if (
    (action === 'alter' || action === 'drop') &&
    (typeof targetEntityIndex === 'undefined' || targetEntityIndex === -1)
  ) {
    throw new RoninError({
      message: `No ${entity} with slug "${slug}" defined in model "${existingModel.name}".`,
      code: MODEL_ENTITY_ERROR_CODES[entity],
    });
  }

  const existingEntity = existingModel[pluralType]?.[targetEntityIndex as number];

  if (entity === 'field') {
    const statement = `ALTER TABLE "${existingModel.table}"`;

    // If the field is of type "link" and the cardinality is "many", that means it does
    // not exist as a column in the database, so we don't need to generate statements for
    // modifying that respective column. The field is handled in the compiler instead.
    const existingField = existingEntity as ModelField | undefined;
    const existingLinkField =
      existingField?.type === 'link' && existingField.kind === 'many';

    if (action === 'create') {
      const field = jsonValue as ModelField;

      // Default field type.
      field.type = field.type || 'string';

      const fieldStatement = getFieldStatement(models, existingModel, field);

      if (fieldStatement) {
        dependencyStatements.push({
          statement: `${statement} ADD COLUMN ${fieldStatement}`,
          params: [],
        });
      }
    } else if (action === 'alter') {
      const newSlug = jsonValue?.slug;

      // Only push the statement if the column name is changing, otherwise we don't
      // need it.
      if (newSlug && !existingLinkField) {
        dependencyStatements.push({
          statement: `${statement} RENAME COLUMN "${slug}" TO "${newSlug}"`,
          params: [],
        });
      }
    } else if (action === 'drop' && !existingLinkField) {
      dependencyStatements.push({
        statement: `${statement} DROP COLUMN "${slug}"`,
        params: [],
      });
    }
  }

  const statementAction = action.toUpperCase();

  if (entity === 'index') {
    const index = jsonValue as ModelIndex;
    const indexName = convertToSnakeCase(slug);

    const params: Array<unknown> = [];
    let statement = `${statementAction}${index?.unique ? ' UNIQUE' : ''} INDEX "${indexName}"`;

    if (action === 'create') {
      const columns = index.fields.map((field) => {
        let fieldSelector = '';

        // If the slug of a field is provided, find the field in the model, obtain its
        // column selector, and place it in the SQL statement.
        if ('slug' in field) {
          ({ fieldSelector } = getFieldFromModel(existingModel, field.slug, 'to'));
        }
        // Alternatively, if an expression is provided instead of the slug of a field,
        // find all fields inside the expression, obtain their column selectors, and
        // insert them into the expression, after which the expression can be used in the
        // SQL statement.
        else if ('expression' in field) {
          fieldSelector = parseFieldExpression(existingModel, 'to', field.expression);
        }

        if (field.collation) fieldSelector += ` COLLATE ${field.collation}`;
        if (field.order) fieldSelector += ` ${field.order}`;

        return fieldSelector;
      });

      statement += ` ON "${existingModel.table}" (${columns.join(', ')})`;

      // If filtering instructions were defined, add them to the index. Those
      // instructions will determine which records are included as part of the index.
      if (index.filter) {
        const withStatement = handleWith(models, existingModel, params, index.filter);
        statement += ` WHERE (${withStatement})`;
      }
    }

    dependencyStatements.push({ statement, params });
  }

  if (entity === 'trigger') {
    const triggerName = convertToSnakeCase(slug);

    const params: Array<unknown> = [];
    let statement = `${statementAction} TRIGGER "${triggerName}"`;

    if (action === 'create') {
      const trigger = jsonValue as ModelTrigger;

      // The different parts of the final statement.
      const statementParts: Array<string> = [`${trigger.when} ${trigger.action}`];

      if (trigger.fields) {
        if (trigger.action !== 'UPDATE') {
          throw new RoninError({
            message: `When ${actionReadable} ${PLURAL_MODEL_ENTITIES[entity]}, targeting specific fields requires the \`UPDATE\` action.`,
            code: 'INVALID_MODEL_VALUE',
            fields: ['action'],
          });
        }

        const fieldSelectors = trigger.fields.map((field) => {
          return getFieldFromModel(existingModel, field.slug, 'to').fieldSelector;
        });

        statementParts.push(`OF (${fieldSelectors.join(', ')})`);
      }

      statementParts.push('ON', `"${existingModel.table}"`);

      // If filtering instructions were defined, or if the effect query references
      // specific record fields, that means the trigger must be executed on a per-record
      // basis, meaning "for each row", instead of on a per-query basis.
      if (
        trigger.filter ||
        trigger.effects.some((query) => findInObject(query, QUERY_SYMBOLS.FIELD))
      ) {
        statementParts.push('FOR EACH ROW');
      }

      // If filtering instructions were defined, add them to the trigger. Those
      // instructions will be validated for every row, and only if they match, the trigger
      // will then be fired.
      if (trigger.filter) {
        const tableAlias =
          trigger.action === 'DELETE'
            ? QUERY_SYMBOLS.FIELD_PARENT_OLD
            : QUERY_SYMBOLS.FIELD_PARENT_NEW;

        const withStatement = handleWith(
          models,
          { ...existingModel, tableAlias: tableAlias },
          params,
          trigger.filter,
        );

        statementParts.push('WHEN', `(${withStatement})`);
      }

      // Compile the effect queries into SQL statements.
      const effectStatements = trigger.effects.map((effectQuery) => {
        return compileQueryInput(effectQuery, models, params, {
          returning: false,
          parentModel: existingModel,
        }).main.statement;
      });

      if (effectStatements.length > 1) statementParts.push('BEGIN');
      statementParts.push(effectStatements.join('; '));
      if (effectStatements.length > 1) statementParts.push('END');

      statement += ` ${statementParts.join(' ')}`;
    }

    dependencyStatements.push({ statement, params });
  }

  const field = `${QUERY_SYMBOLS.FIELD}${pluralType}`;

  let json: string;

  switch (action) {
    case 'create': {
      const value = prepareStatementValue(statementParams, jsonValue);
      json = `json_insert(${field}, '$.${slug}', ${value})`;

      // Add the newly created entity to the model.
      (existingModel[pluralType] as Array<ModelEntity>) = [
        ...(existingModel[pluralType] || []),
        jsonValue,
      ] as Array<ModelEntity>;

      break;
    }
    case 'alter': {
      const value = prepareStatementValue(statementParams, jsonValue);
      json = `json_set(${field}, '$.${slug}', json_patch(json_extract(${field}, '$.${slug}'), ${value}))`;

      // Update the existing entity in the model.
      const targetEntity = existingModel[pluralType] as Array<ModelEntity>;
      Object.assign(targetEntity[targetEntityIndex as number], jsonValue);

      break;
    }
    case 'drop': {
      json = `json_remove(${field}, '$.${slug}')`;

      // Remove the existing entity from the model.
      const targetEntity = existingModel[pluralType] as Array<ModelEntity>;
      targetEntity.splice(targetEntityIndex as number, 1);
    }
  }

  const currentSystemModels = models.filter(({ system }) => {
    return system?.model === existingModel.slug;
  });

  const newSystemModels = getSystemModels(models, existingModel);

  /**
   * Determines whether a system model should continue to exist, or not.
   *
   * @param oldSystemModel - The old system model that currently already exists.
   * @param newSystemModel - A new system model to compare it against.
   *
   * @returns Whether the system model should continue to exist.
   */
  const matchSystemModels = (
    oldSystemModel: PartialModel,
    newSystemModel: PartialModel,
  ) => {
    const conditions: Array<boolean> = [
      oldSystemModel.system?.model === newSystemModel.system?.model,
    ];

    // If an old system model is acting as an associative model between two
    // manually-defined models, we need to check whether the new system model is used for
    // the same model field.
    if (oldSystemModel.system?.associationSlug) {
      const oldFieldIndex = modelBeforeUpdate?.fields.findIndex((item) => {
        return item.slug === (newSystemModel.system?.associationSlug as string);
      });

      const newFieldIndex = existingModel.fields.findIndex((item) => {
        return item.slug === (oldSystemModel.system?.associationSlug as string);
      });

      conditions.push(oldFieldIndex === newFieldIndex);
    }

    return conditions.every((condition) => condition === true);
  };

  // Remove any system models that are no longer required.
  for (const systemModel of currentSystemModels) {
    // Check if there are any system models that should continue to exist.
    const exists = newSystemModels.find(matchSystemModels.bind(null, systemModel));

    if (exists) {
      // Determine if the slug of the system model has changed. If so, alter the
      // respective table.
      if (exists.slug !== systemModel.slug) {
        handleSystemModel(models, dependencyStatements, 'alter', systemModel, exists);
      }
      continue;
    }

    handleSystemModel(models, dependencyStatements, 'drop', systemModel);
  }

  // Add any new system models that don't yet exist.
  for (const systemModel of newSystemModels) {
    // Check if there are any system models that already exist.
    const exists = currentSystemModels.find(matchSystemModels.bind(null, systemModel));
    if (exists) continue;

    handleSystemModel(models, dependencyStatements, 'create', systemModel);
  }

  return {
    set: {
      model: {
        with: { slug: modelSlug },
        to: {
          [pluralType]: { [QUERY_SYMBOLS.EXPRESSION]: json },
        },
      },
    },
  };
};
