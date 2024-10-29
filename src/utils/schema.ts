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
  return convertToSnakeCase(schema.pluralSlug);
};

/**
 * Composes a display name for a schema.
 *
 * @param schema - The schema to compose a display name for.
 *
 * @returns A display name for the schema.
 */
export const getSchemaName = (schema: Schema): string => {
  return schema.name || schema.slug;
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
      message: `${errorPrefix} does not exist in schema "${getSchemaName(schema)}".`,
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
      { slug: 'schema', type: 'reference', target: 'schema' },
      { slug: 'target', type: 'reference', target: 'schema' },
      { slug: 'required', type: 'boolean' },
      { slug: 'defaultValue', type: 'string' },
      { slug: 'unique', type: 'boolean' },
      { slug: 'autoIncrement', type: 'boolean' },
    ],
  },
];

/**
 * Extends a list of schemas with automatically generated schemas that make writing
 * queries even easier, and adds system fields to every schema.
 *
 * @param schemas - The list of schemas to extend.
 *
 * @returns The extended list of schemas.
 */
export const addSystemSchemas = (schemas: Array<Schema>): Array<Schema> => {
  const list = [...SYSTEM_SCHEMAS, ...schemas].map((schema) => ({ ...schema }));

  for (const schema of list) {
    const defaultIncluding: Record<string, Query> = {};

    // Add default shortcuts, which people can overwrite if they want to. Shortcuts are
    // used to provide concise ways of writing advanced queries, by allowing for defining
    // complex queries inside the schema definitions and re-using them across many
    // different queries in the codebase of an application.
    for (const field of schema.fields || []) {
      if (field.type === 'reference' && !field.slug.startsWith('ronin.')) {
        const relatedSchema = getSchemaBySlug(list, field.target);

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
                target: schema.slug,
              },
              {
                slug: 'target',
                type: 'reference',
                target: relatedSchema.slug,
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
        const relatedSchemaToModify = list.find((schema) => schema.slug === field.target);
        if (!relatedSchemaToModify) throw new Error('Missing related schema');

        relatedSchemaToModify.including = {
          [schema.pluralSlug]: {
            get: {
              [schema.pluralSlug]: {
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
const getFieldStatement = (schemas: Array<Schema>, field: SchemaField): string | null => {
  if (field.type === 'group') return null;

  let statement = `"${field.slug}" ${typesInSQLite[field.type]}`;

  if (field.slug === 'id') statement += ' PRIMARY KEY';
  if (field.unique === true) statement += ' UNIQUE';
  if (field.required === true) statement += ' NOT NULL';
  if (typeof field.defaultValue !== 'undefined')
    statement += ` DEFAULT ${field.defaultValue}`;

  if (field.type === 'reference') {
    const actions = field.actions || {};

    const targetSchema = getSchemaBySlug(schemas, field.target);
    const targetTable = getTableForSchema(targetSchema);

    statement += ` REFERENCES ${targetTable}("id")`;

    for (const trigger in actions) {
      const triggerName = trigger.toUpperCase().slice(2);
      const action = actions[
        trigger as keyof typeof actions
      ] as SchemaFieldReferenceAction;

      statement += ` ${triggerName} ${action}`;
    }
  }

  return statement;
};

/**
 * Generates the necessary SQL dependency statements for queries such as `create.schema`,
 * which are used to create, update, or delete schemas and fields. The generated
 * dependency statements are used to alter the SQLite database schema.
 *
 * @param schemas - A list of schemas.
 * @param queryDetails - The parsed details of the query that is being executed.
 * @param writeStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 *
 * @returns Nothing.
 */
export const addSchemaQueries = (
  schemas: Array<Schema>,
  queryDetails: ReturnType<typeof splitQuery>,
  writeStatements: Array<string>,
) => {
  const { queryType, querySchema, queryInstructions } = queryDetails;

  // Only continue if the query is a write query.
  if (!['create', 'set', 'drop'].includes(queryType)) return;

  // Only continue if the query addresses the "schema" schema.
  if (!['schema', 'schemas', 'field', 'fields'].includes(querySchema)) return;

  const instructionName = mappedInstructions[queryType] as QueryInstructionTypeClean;
  const instructionList = queryInstructions[instructionName] as WithInstruction;

  // Whether schemas or fields are being updated.
  const kind = ['schema', 'schemas'].includes(querySchema) ? 'schemas' : 'fields';

  const instructionTarget =
    kind === 'schemas' ? instructionList : instructionList?.schema;

  let tableAction = 'ALTER';
  let schemaPluralSlug: string | null = null;
  let queryTypeReadable: string | null = null;

  switch (queryType) {
    case 'create': {
      if (kind === 'schemas') tableAction = 'CREATE';
      schemaPluralSlug = instructionTarget?.pluralSlug;
      queryTypeReadable = 'creating';
      break;
    }

    case 'set': {
      if (kind === 'schemas') tableAction = 'ALTER';
      schemaPluralSlug =
        instructionTarget?.pluralSlug?.being || instructionTarget?.pluralSlug;
      queryTypeReadable = 'updating';
      break;
    }

    case 'drop': {
      if (kind === 'schemas') tableAction = 'DROP';
      schemaPluralSlug =
        instructionTarget?.pluralSlug?.being || instructionTarget?.pluralSlug;
      queryTypeReadable = 'deleting';
      break;
    }
  }

  if (!schemaPluralSlug) {
    const field = kind === 'schemas' ? 'pluralSlug' : 'schema.pluralSlug';

    throw new RoninError({
      message: `When ${queryTypeReadable} ${kind}, a \`${field}\` field must be provided in the \`${instructionName}\` instruction.`,
      code: 'MISSING_FIELD',
      fields: [field],
    });
  }

  const table = convertToSnakeCase(schemaPluralSlug);
  const fields = [...SYSTEM_FIELDS];

  let statement = `${tableAction} TABLE "${table}"`;

  if (kind === 'schemas') {
    if (queryType === 'create') {
      const columns = fields
        .map((field) => getFieldStatement(schemas, field))
        .filter(Boolean);

      statement += ` (${columns.join(', ')})`;
    } else if (queryType === 'set') {
      const newSlug = queryInstructions.to?.pluralSlug;

      if (newSlug) {
        const newTable = convertToSnakeCase(newSlug);
        statement += ` RENAME TO "${newTable}"`;
      }
    }
  } else if (kind === 'fields') {
    const fieldSlug = instructionTarget?.slug?.being || instructionList?.slug;

    if (!fieldSlug) {
      throw new RoninError({
        message: `When ${queryTypeReadable} fields, a \`slug\` field must be provided in the \`${instructionName}\` instruction.`,
        code: 'MISSING_FIELD',
        fields: ['slug'],
      });
    }

    if (queryType === 'create') {
      if (!instructionList.type) {
        throw new RoninError({
          message: `When ${queryTypeReadable} fields, a \`type\` field must be provided in the \`to\` instruction.`,
          code: 'MISSING_FIELD',
          fields: ['type'],
        });
      }

      statement += ` ADD COLUMN ${getFieldStatement(schemas, instructionList as SchemaField)}`;
    } else if (queryType === 'set') {
      const newSlug = queryInstructions.to?.slug;

      if (newSlug) {
        statement += ` RENAME COLUMN "${fieldSlug}" TO "${newSlug}"`;
      }
    } else if (queryType === 'drop') {
      statement += ` DROP COLUMN "${fieldSlug}"`;
    }
  }

  writeStatements.push(statement);
};
