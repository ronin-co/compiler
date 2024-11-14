import type { GetInstructions, Query, WithInstruction } from '@/src/types/query';

type ModelFieldBasics = {
  name?: string;
  slug: string;
  displayAs?: string;
  unique?: boolean;
  required?: boolean;
  defaultValue?: unknown;
};

type ModelFieldNormal = ModelFieldBasics & {
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'group';
};

export type ModelFieldReferenceAction =
  | 'CASCADE'
  | 'RESTRICT'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'NO ACTION';

export type ModelFieldReference = ModelFieldBasics & {
  type: 'reference';

  // Make the `slug` required.
  target: Omit<Partial<Model>, 'slug'> & Pick<Model, 'slug'>;

  kind?: 'one' | 'many';
  actions?: {
    onDelete?: ModelFieldReferenceAction;
    onUpdate?: ModelFieldReferenceAction;
  };
};

export type ModelField = ModelFieldNormal | ModelFieldReference;

export type ModelIndexField = {
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

export type ModelIndex = {
  /**
   * The list of fields in the model for which the index should be created.
   */
  fields: Array<ModelIndexField>;
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

export type ModelTriggerField = {
  /**
   * The slug of the field that should cause the trigger to fire if the value of the
   * field has changed.
   */
  slug: string;
};

export type ModelTrigger = {
  /** The type of query for which the trigger should fire. */
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  /** When the trigger should fire in the case that a maching query is executed. */
  when: 'BEFORE' | 'DURING' | 'AFTER';
  /** A list of queries that should be executed when the trigger fires. */
  effects: Array<Query>;
  /** A list of field slugs for which the trigger should fire. */
  fields?: Array<ModelTriggerField>;
  /**
   * An object containing query instructions used to determine whether the trigger should
   * fire, or not.
   */
  filter?: WithInstruction;
};

export type ModelPreset = {
  /** The identifier that can be used for adding the preset to a query. */
  slug: string;
  /** The query instructions that should be applied when the preset is used. */
  instructions: GetInstructions;
};

export interface Model {
  name: string;
  pluralName: string;
  slug: string;
  pluralSlug: string;

  identifiers: {
    name: string;
    slug: string;
  };
  idPrefix: string;

  /**
   * If the model is used to associate two models with each other (in the case of
   * many-cardinality reference fields), this property should contain the field to which
   * the associative model should be mounted.
   */
  associationSlug?: string;

  fields?: Array<ModelField>;
  indexes?: Array<ModelIndex>;
  triggers?: Array<ModelTrigger>;
  presets?: Array<ModelPreset>;
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

export type PartialModel = RecursivePartial<Model>;

// In models provided to the compiler, all settings are optional, except for the `slug`,
// which is the required bare minimum.
export type PublicModel = Omit<
  Partial<Model>,
  'slug' | 'identifiers' | 'associationSlug'
> & {
  slug: Required<Model['slug']>;

  // It should also be possible for models to only define one of the two identifiers,
  // since the missing one will be generated automatically.
  identifiers?: Partial<Model['identifiers']>;
};
