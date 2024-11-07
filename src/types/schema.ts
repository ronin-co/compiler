import type { Query, QueryType, WithInstruction } from '@/src/types/query';

type SchemaFieldBasics = {
  name?: string;
  slug: string;
  displayAs?: string;
  unique?: boolean;
  required?: boolean;
  defaultValue?: unknown;
};

type SchemaFieldNormal = SchemaFieldBasics & {
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'group';
};

export type SchemaFieldReferenceAction =
  | 'CASCADE'
  | 'RESTRICT'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'NO ACTION';

export type SchemaFieldReference = SchemaFieldBasics & {
  type: 'reference';

  // Make the `slug` required.
  target: Omit<Partial<Schema>, 'slug'> & Pick<Schema, 'slug'>;

  kind?: 'one' | 'many';
  actions?: {
    onDelete?: SchemaFieldReferenceAction;
    onUpdate?: SchemaFieldReferenceAction;
  };
};

export type SchemaField = SchemaFieldNormal | SchemaFieldReference;

type SchemaIndexField = {
  /** The field slug or expression for which the index should be created. */
  expression: string;
  /** The collating sequence used for text placed inside the field. */
  collation?: 'BINARY' | 'NOCASE' | 'RTRIM';
  /** How the records in the index should be ordered. */
  order?: 'ASC' | 'DESC';
};

type SchemaIndex = {
  /**
   * The list of fields in the schema for which the index should be created.
   */
  fields: Array<SchemaIndexField>;
  /**
   * Whether only one record with a unique value for the provided fields will be allowed.
   */
  unique?: boolean;
  /**
   * An object containing query instructions that will be used to match the records that
   * should be included in the index.
   */
  filter?: WithInstruction;
};

type SchemaTrigger = {
  /** The type of query for which the trigger should fire. */
  queryType: Uppercase<Exclude<QueryType, 'get' | 'count'>>;
  /** When the trigger should fire in the case that a maching query is executed. */
  timing: 'BEFORE' | 'DURING' | 'AFTER';
  /** A list of queries that should be executed when the trigger fires. */
  effects: Array<Query>;
  /** A list of field slugs for which the trigger should fire. */
  fields?: Array<string>;
  /**
   * An object containing query instructions used to determine whether the trigger should
   * fire, or not.
   */
  filter?: WithInstruction;
};

export interface Schema {
  name?: string;
  pluralName?: string;
  slug: string;
  pluralSlug?: string;

  identifiers?: {
    title?: string;
    slug?: string;
  };
  idPrefix?: string;

  including?: Record<string, Query>;
  for?: Record<string, WithInstruction>;

  fields?: Array<SchemaField>;
  indexes?: Array<SchemaIndex>;
  triggers?: Array<SchemaTrigger>;
}
