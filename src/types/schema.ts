import type { Query, WithInstruction } from '@/src/types/query';

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

export type SchemaIndexField = {
  /** The collating sequence used for text placed inside the field. */
  collation?: 'BINARY' | 'NOCASE' | 'RTRIM';
  /** How the records in the index should be ordered. */
  order?: 'ASC' | 'DESC';
} & (
  | {
      /** The field slug for which the index should be created. */
      slug: string;
    }
  | {
      /** The field expression for which the index should be created. */
      expression: string;
    }
);

export type SchemaIndex = {
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

export type SchemaTriggerField = {
  /**
   * The slug of the field that should cause the trigger to fire if the value of the
   * field has changed.
   */
  slug: string;
};

export type SchemaTrigger = {
  /** The type of query for which the trigger should fire. */
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  /** When the trigger should fire in the case that a maching query is executed. */
  when: 'BEFORE' | 'DURING' | 'AFTER';
  /** A list of queries that should be executed when the trigger fires. */
  effects: Array<Query>;
  /** A list of field slugs for which the trigger should fire. */
  fields?: Array<SchemaTriggerField>;
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

  identifiers: {
    name: string;
    slug: string;
  };
  idPrefix?: string;

  including?: Record<string, Query>;
  for?: Record<string, WithInstruction>;

  fields?: Array<SchemaField>;
  indexes?: Array<SchemaIndex>;
  triggers?: Array<SchemaTrigger>;
}

// In schemas provided to the compiler, all settings are optional, except for the `slug`,
// which is the required bare minimum.
export type PublicSchema = Omit<Partial<Schema>, 'slug' | 'identifiers'> & {
  slug: Required<Schema['slug']>;

  // It should also be possible for schemas to only define one of the two identifiers,
  // since the missing one will be generated automatically.
  identifiers?: Partial<Schema['identifiers']>;
};
