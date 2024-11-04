import type {
  Query,
  QueryInstructionType,
  QueryType,
  WithInstruction,
} from '@/src/types/query';
import type { Schema, SchemaField, SchemaFieldReferenceAction } from '@/src/types/schema';
import {
  RONIN_SCHEMA_SYMBOLS,
  RoninError,
  convertToCamelCase,
  convertToSnakeCase,
  type splitQuery,
} from '@/src/utils';
import title from 'title';

/**
 * Finds a schema by its slug or plural slug.
 *
 * @param schemas - A list of schemas.
 * @param slug - The slug to search for.
 *
 * @returns A schema for the provided slug or plural slug.
 */
export const getSchemaBySlug = (schemas: Array<Schema>, slug: string): Schema => {
  const schema = schemas.find((schema) => {
    return schema.slug === slug || schema.pluralSlug === slug;
  });

  if (!schema) {
    throw new RoninError({
      message: `No matching schema with either Slug or Plural Slug of "${slug}" could be found.`,
      code: 'SCHEMA_NOT_FOUND',
    });
  }

  return schema;
};

/**
 * Composes the SQLite table name for a given RONIN schema.
 *
 * @param schema - The schema to compose the table name for.
 *
 * @returns A table name.
 */
export const getTableForSchema = (schema: Schema): string => {
  return convertToSnakeCase(schema.pluralSlug as string);
};

/**
 * Composes a slug for a schema that was automatically provided by the system, instead
 * of being provided by a developer.
 *
 * @param suffix - A suffix to append to the generated slug.
 *
 * @returns A slug for a schema that was automatically provided by the system.
 */
const composeMetaSchemaSlug = (suffix: string) => convertToCamelCase(`ronin_${suffix}`);

/**
 * Composes the slug of an associative schema that is used to establish a relationship
 * between two schemas that are not directly related to each other.
 *
 * @param schema - The schema that contains the reference field.
 * @param field - The reference field that is being used to establish the relationship.
 *
 * @returns A slug for the associative schema.
 */
export const composeAssociationSchemaSlug = (schema: Schema, field: SchemaField) =>
  composeMetaSchemaSlug(`${schema.pluralSlug}_${field.slug}`);

/**
 * Constructs the SQL selector for a given field in a schema.
 *
 * @param field - A field from a schema.
 * @param fieldPath - The path of the field being addressed. Supports dot notation for
 * accessing nested fields.
 * @param rootTable - The name of a table, if it should be included in the SQL selector.
 *
 * @returns The SQL column selector for the provided field.
 */
const getFieldSelector = (field: SchemaField, fieldPath: string, rootTable?: string) => {
  const tablePrefix = rootTable ? `"${rootTable}".` : '';

  // If nested fields are allowed and the name of the field contains a period, that means
  // we need to select a nested property from within a JSON field.
  if (field.type === 'json') {
    const dotParts = fieldPath.split('.');
    const columnName = tablePrefix + dotParts.shift();
    const jsonField = dotParts.join('.');

    return `json_extract(${columnName}, '$.${jsonField}')`;
  }

  return `${tablePrefix}"${fieldPath}"`;
};

/**
 * Obtains a field from a given schema using its path.
 *
 * @param schema - The schema to retrieve the field from.
 * @param fieldPath - The path of the field to retrieve. Supports dot notation for
 * accessing nested fields.
 * @param instructionName - The name of the query instruction that is being used.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The requested field of the schema, and its SQL selector.
 */
export const getFieldFromSchema = (
  schema: Schema,
  fieldPath: string,
  instructionName: QueryInstructionType,
  rootTable?: string,
): { field: SchemaField; fieldSelector: string } => {
  const errorPrefix = `Field "${fieldPath}" defined for \`${instructionName}\``;
  const schemaFields = schema.fields || [];

  let schemaField: SchemaField | undefined;

  // If the field being accessed is actually a nested property of a JSON field, return
  // that root JSON field.
  if (fieldPath.includes('.')) {
    schemaField = schemaFields.find((field) => field.slug === fieldPath.split('.')[0]);

    if (schemaField?.type === 'json') {
      const fieldSelector = getFieldSelector(schemaField, fieldPath, rootTable);
      return { field: schemaField, fieldSelector };
    }
  }

  schemaField = schemaFields.find((field) => field.slug === fieldPath);

  if (!schemaField) {
    throw new RoninError({
      message: `${errorPrefix} does not exist in schema "${schema.name}".`,
      code: 'FIELD_NOT_FOUND',
      field: fieldPath,
      queries: null,
    });
  }

  const fieldSelector = getFieldSelector(schemaField, fieldPath, rootTable);
  return { field: schemaField, fieldSelector };
};

/** These fields are required by the system and automatically added to every schema. */
const SYSTEM_FIELDS: Array<SchemaField> = [
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

/** These schemas are required by the system and are automatically made available. */
const SYSTEM_SCHEMAS: Array<Schema> = [
  {
    name: 'Schema',
    pluralName: 'Schemas',

    slug: 'schema',
    pluralSlug: 'schemas',

    fields: [
      ...SYSTEM_FIELDS,
      { slug: 'name', type: 'string' },
      { slug: 'pluralName', type: 'string' },
      { slug: 'slug', type: 'string' },
      { slug: 'pluralSlug', type: 'string' },
      { slug: 'idPrefix', type: 'string' },
      { slug: 'identifiers', type: 'group' },
      { slug: 'identifiers.title', type: 'string' },
      { slug: 'identifiers.slug', type: 'string' },
    ],
  },
  {
    name: 'Field',
    pluralName: 'Fields',

    slug: 'field',
    pluralSlug: 'fields',

    fields: [
      ...SYSTEM_FIELDS,
      { slug: 'name', type: 'string' },
      { slug: 'slug', type: 'string', required: true },
      { slug: 'type', type: 'string', required: true },
      {
        slug: 'schema',
        type: 'reference',
        target: { slug: 'schema' },
        required: true,
      },
      { slug: 'required', type: 'boolean' },
      { slug: 'defaultValue', type: 'string' },
      { slug: 'unique', type: 'boolean' },
      { slug: 'autoIncrement', type: 'boolean' },

      // Only allowed for fields of type "reference".
      { slug: 'target', type: 'reference', target: { slug: 'schema' } },
      { slug: 'kind', type: 'string' },
      { slug: 'actions', type: 'group' },
      { slug: 'actions.onDelete', type: 'string' },
      { slug: 'actions.onUpdate', type: 'string' },
    ],
  },
  {
    name: 'Index',
    pluralName: 'Indexes',

    slug: 'index',
    pluralSlug: 'indexes',

    fields: [
      ...SYSTEM_FIELDS,

      { slug: 'slug', type: 'string', required: true },
      {
        slug: 'schema',
        type: 'reference',
        target: { slug: 'schema' },
        required: true,
      },
      { slug: 'unique', type: 'boolean' },
      { slug: 'filter', type: 'json' },
    ],
  },
];

/**
 * We are computing this at the root level in order to avoid computing it again with
 * every function call.
 */
const SYSTEM_SCHEMA_SLUGS = SYSTEM_SCHEMAS.flatMap(({ slug, pluralSlug }) => [
  slug,
  pluralSlug,
]);

/**
 * Extends a list of schemas with automatically generated schemas that make writing
 * queries even easier, and adds system fields to every schema.
 *
 * @param schemas - The list of schemas to extend.
 *
 * @returns The extended list of schemas.
 */
export const addSystemSchemas = (schemas: Array<Schema>): Array<Schema> => {
  const list = [...SYSTEM_SCHEMAS, ...schemas].map((schema) => {
    const copiedSchema = { ...schema };

    if (!copiedSchema.pluralSlug) copiedSchema.pluralSlug = pluralize(copiedSchema.slug);

    if (!copiedSchema.name) copiedSchema.name = slugToName(copiedSchema.slug);
    if (!copiedSchema.pluralName)
      copiedSchema.pluralName = slugToName(copiedSchema.pluralSlug);

    return copiedSchema;
  });

  for (const schema of list) {
    const defaultIncluding: Record<string, Query> = {};

    // Add default shortcuts, which people can overwrite if they want to. Shortcuts are
    // used to provide concise ways of writing advanced queries, by allowing for defining
    // complex queries inside the schema definitions and re-using them across many
    // different queries in the codebase of an application.
    for (const field of schema.fields || []) {
      if (field.type === 'reference' && !field.slug.startsWith('ronin.')) {
        const relatedSchema = getSchemaBySlug(list, field.target.slug);

        let fieldSlug = relatedSchema.slug;

        // If a reference field with a cardinality of "many" is found, we would like to
        // initialize an invisible associative schema, which is used to establish the
        // relationship between the first and second schema, even though those two are
        // not directly related to each other.
        if (field.kind === 'many') {
          fieldSlug = composeAssociationSchemaSlug(schema, field);

          list.push({
            pluralSlug: fieldSlug,
            slug: fieldSlug,
            fields: [
              {
                slug: 'source',
                type: 'reference',
                target: schema,
              },
              {
                slug: 'target',
                type: 'reference',
                target: relatedSchema,
              },
            ],
          });
        }

        // For every reference field, add a default shortcut for resolving the referenced
        // record in the schema that contains the reference field.
        defaultIncluding[field.slug] = {
          get: {
            [fieldSlug]: {
              with: {
                // Compare the `id` field of the related schema to the reference field on
                // the root schema (`field.slug`).
                id: `${RONIN_SCHEMA_SYMBOLS.FIELD}${field.slug}`,
              },
            },
          },
        };

        // Additionally, add a default shortcut for resolving the child records in the
        // related schema.
        const relatedSchemaToModify = getSchemaBySlug(list, field.target.slug);
        if (!relatedSchemaToModify) throw new Error('Missing related schema');

        relatedSchemaToModify.including = {
          [schema.pluralSlug as string]: {
            get: {
              [schema.pluralSlug as string]: {
                with: {
                  [field.slug]: `${RONIN_SCHEMA_SYMBOLS.FIELD}id`,
                },
              },
            },
          },
          ...relatedSchemaToModify.including,
        };
      }
    }

    schema.fields = [...SYSTEM_FIELDS, ...(schema.fields || [])];
    schema.including = { ...defaultIncluding, ...schema.including };
  }

  return list;
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
  reference: 'TEXT',
  string: 'TEXT',
  date: 'DATETIME',
  blob: 'TEXT',
  boolean: 'BOOLEAN',
  number: 'INTEGER',
  json: 'TEXT',
};

/**
 * Composes the SQL syntax for a field in a RONIN schema.
 *
 * @param schemas - A list of schemas.
 * @param field - The field of a RONIN schema.
 *
 * @returns The SQL syntax for the provided field.
 */
const getFieldStatement = (field: SchemaField): string | null => {
  if (field.type === 'group') return null;

  let statement = `"${field.slug}" ${typesInSQLite[field.type]}`;

  if (field.slug === 'id') statement += ' PRIMARY KEY';
  if (field.unique === true) statement += ' UNIQUE';
  if (field.required === true) statement += ' NOT NULL';
  if (typeof field.defaultValue !== 'undefined')
    statement += ` DEFAULT ${field.defaultValue}`;

  if (field.type === 'reference') {
    const actions = field.actions || {};
    const targetTable = convertToSnakeCase(field.target.slug);

    statement += ` REFERENCES ${targetTable}("id")`;

    for (const trigger in actions) {
      const triggerName = trigger.toUpperCase().slice(2);
      const action = actions[
        trigger as keyof typeof actions
      ] as SchemaFieldReferenceAction;

      statement += ` ON ${triggerName} ${action}`;
    }
  }

  return statement;
};

/**
 * Generates the necessary SQL dependency statements for queries such as `create.schema`,
 * which are used to create, update, or delete schemas and fields. The generated
 * dependency statements are used to alter the SQLite database schema.
 *
 * @param queryDetails - The parsed details of the query that is being executed.
 * @param writeStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 *
 * @returns Nothing.
 */
export const addSchemaQueries = (
  queryDetails: ReturnType<typeof splitQuery>,
  writeStatements: Array<string>,
) => {
  const { queryType, querySchema, queryInstructions } = queryDetails;

  // Only continue if the query is a write query.
  if (!['create', 'set', 'drop'].includes(queryType)) return;

  // Only continue if the query addresses system schemas.
  if (!SYSTEM_SCHEMA_SLUGS.includes(querySchema)) return;

  const instructionName = mappedInstructions[queryType] as QueryInstructionTypeClean;
  const instructionList = queryInstructions[instructionName] as WithInstruction;

  // Whether schemas or fields are being updated.
  const kind = getSchemaBySlug(SYSTEM_SCHEMAS, querySchema).pluralSlug;

  let tableAction = 'ALTER';
  let queryTypeReadable: string | null = null;

  switch (queryType) {
    case 'create': {
      if (kind === 'schemas' || kind === 'indexes') tableAction = 'CREATE';
      queryTypeReadable = 'creating';
      break;
    }

    case 'set': {
      if (kind === 'schemas') tableAction = 'ALTER';
      queryTypeReadable = 'updating';
      break;
    }

    case 'drop': {
      if (kind === 'schemas' || kind === 'indexes') tableAction = 'DROP';
      queryTypeReadable = 'deleting';
      break;
    }
  }

  const slug: string | null = instructionList?.slug?.being || instructionList?.slug;

  if (!slug) {
    throw new RoninError({
      message: `When ${queryTypeReadable} ${kind}, a \`slug\` field must be provided in the \`${instructionName}\` instruction.`,
      code: 'MISSING_FIELD',
      fields: ['slug'],
    });
  }

  const schemaInstruction = instructionList?.schema;
  const schemaSlug = schemaInstruction?.slug?.being || schemaInstruction?.slug;

  if (kind !== 'schemas' && !schemaSlug) {
    throw new RoninError({
      message: `When ${queryTypeReadable} ${kind}, a \`schema.slug\` field must be provided in the \`${instructionName}\` instruction.`,
      code: 'MISSING_FIELD',
      fields: ['schema.slug'],
    });
  }

  const tableName = convertToSnakeCase(kind === 'schemas' ? slug : schemaSlug);

  if (kind === 'indexes') {
    const indexName = convertToSnakeCase(slug);
    const unique: boolean | undefined = instructionList?.unique;

    let statement = `${tableAction}${unique ? ' UNIQUE' : ''} INDEX "${indexName}"`;
    if (queryType === 'create') statement += ` ON "${tableName}"`;

    writeStatements.push(statement);
    return;
  }

  let statement = `${tableAction} TABLE "${tableName}"`;

  if (kind === 'schemas') {
    const fields = [...SYSTEM_FIELDS];

    if (queryType === 'create') {
      const columns = fields.map(getFieldStatement).filter(Boolean);

      statement += ` (${columns.join(', ')})`;
    } else if (queryType === 'set') {
      const newSlug = queryInstructions.to?.slug;

      if (newSlug) {
        const newTable = convertToSnakeCase(newSlug);
        statement += ` RENAME TO "${newTable}"`;
      }
    }

    writeStatements.push(statement);
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

      statement += ` ADD COLUMN ${getFieldStatement(instructionList as SchemaField)}`;
    } else if (queryType === 'set') {
      const newSlug = queryInstructions.to?.slug;

      if (newSlug) {
        statement += ` RENAME COLUMN "${slug}" TO "${newSlug}"`;
      }
    } else if (queryType === 'drop') {
      statement += ` DROP COLUMN "${slug}"`;
    }

    writeStatements.push(statement);
  }
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
export const slugToName = (slug: string) => {
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
export const pluralize = (word: string) => {
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
    // If the word ends with 's', 'ch', or 'sh', add 'es'
    return `${word}es`;
  }

  // In all other cases, simply add 's'
  return `${word}s`;
};
