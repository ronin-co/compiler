import type {
  Expression,
  GetInstructions,
  Query,
  WithInstruction,
} from '@/src/types/query';

type ModelFieldCollation = 'BINARY' | 'NOCASE' | 'RTRIM';

type ModelFieldBasics = {
  name?: string;
  slug: string;
  displayAs?: string;
  unique?: boolean;
  required?: boolean;
  defaultValue?: unknown;
  check?: Expression;
  collation?: ModelFieldCollation;
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
  type: 'link';

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
  collation?: ModelFieldCollation;
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

  /** The name of the table in SQLite. */
  table: string;
  /**
   * The table name to which the model was aliased. This will be set in the case that
   * multiple tables are being joined into one SQL statement.
   */
  tableAlias?: string;

  /**
   * If the model is used to associate two models with each other (in the case of
   * many-cardinality link fields), this property should contain the field slug to which
   * the associative model should be mounted on the source model.
   */
  associationSlug?: string;

  // Fields are not optional for internal models, because internal models within the
  // compiler always at least contain the default fields. For models that are passed into
  // the compiler from the outside, the fields are optional, because the compiler will
  // add the default fields automatically, and those are enough to create a model.
  fields: Array<ModelField>;
  indexes?: Array<ModelIndex>;
  triggers?: Array<ModelTrigger>;
  presets?: Array<ModelPreset>;
}

export type PartialModel = Omit<Partial<Model>, 'identifiers'> & {
  identifiers?: Partial<Model['identifiers']>;
};

// In models provided to the compiler, all settings are optional, except for the `slug`,
// which is the required bare minimum.
export type PublicModel = Omit<
  Partial<Model>,
  'slug' | 'identifiers' | 'associationSlug' | 'table' | 'tableAlias'
> & {
  slug: Required<Model['slug']>;

  // It should also be possible for models to only define one of the two identifiers,
  // since the missing one will be generated automatically.
  identifiers?: Partial<Model['identifiers']>;
};
