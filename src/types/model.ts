import type {
  Expression,
  GetInstructions,
  Query,
  WithInstruction,
} from '@/src/types/query';

type ModelFieldCollation = 'BINARY' | 'NOCASE' | 'RTRIM';

type ModelFieldBasics = {
  /** The label that should be used when displaying the field on the RONIN dashboard. */
  name?: string;
  /** Allows for addressing the field programmatically. */
  slug: string;
  /** How the field should be displayed visually on the RONIN dashboard. */
  displayAs?: string;
  /**
   * If set, only one record of the same model will be allowed to exist with a given
   * value for the field.
   */
  unique?: boolean;
  /**
   * Whether a value must be provided for the field. If this attribute is set and no
   * value is provided, an error will be thrown.
   */
  required?: boolean;
  /**
   * The value that should be inserted into the field in the case that no value was
   * explicitly provided for it when a record is created.
   */
  defaultValue?: unknown;
  /**
   * An expression that should be evaluated to form the value of the field. The
   * expression can either be VIRTUAL (evaluated whenever a record is read) or STORED
   * (evaluated whenever a record is created or updated).
   */
  computedAs?: {
    kind: 'VIRTUAL' | 'STORED';
    value: Expression;
  };
  /** An expression that gets evaluated every time a value is provided for the field. */
  check?: Expression;
  /**
   * If the field is of type `string`, setting this attribute defines the collation
   * sequence to use for the field value.
   */
  collation?: ModelFieldCollation;
  /**
   * If the field is of type `number`, setting this attribute will automatically increment
   * the value of the field with every new record that gets inserted.
   */
  increment?: boolean;
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
  target: string;
  kind?: 'one' | 'many';
  actions?: {
    onDelete?: ModelFieldReferenceAction;
    onUpdate?: ModelFieldReferenceAction;
  };
};

export type ModelField = ModelFieldNormal | ModelFieldReference;

export type ModelIndexField<T extends Array<ModelField>> = {
  /** The collating sequence used for text placed inside the field. */
  collation?: ModelFieldCollation;
  /** How the records in the index should be ordered. */
  order?: 'ASC' | 'DESC';
} & (
  | {
      /** The field slug for which the index should be created. */
      slug: T[number]['slug'];
    }
  | {
      /** The field expression for which the index should be created. */
      expression: string;
    }
);

export type ModelIndex<T extends Array<ModelField>> = {
  /**
   * The list of fields in the model for which the index should be created.
   */
  fields: Array<ModelIndexField<T>>;
  /**
   * The identifier of the index.
   */
  slug?: string;
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
  /** When the trigger should fire in the case that a matching query is executed. */
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

export interface Model<T extends Array<ModelField> = Array<ModelField>> {
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
  fields: T;
  indexes?: Array<ModelIndex<T>>;
  triggers?: Array<ModelTrigger>;
  presets?: Array<ModelPreset>;
}

export type PartialModel = Omit<Partial<Model>, 'identifiers'> & {
  identifiers?: Partial<Model['identifiers']>;
};

// In models provided to the compiler, all settings are optional, except for the `slug`,
// which is the required bare minimum.
export type PublicModel<T extends Array<ModelField>> = Omit<
  Partial<Model<T>>,
  'slug' | 'identifiers' | 'associationSlug' | 'table' | 'tableAlias'
> & {
  slug: Required<Model['slug']>;

  // It should also be possible for models to only define one of the two identifiers,
  // since the missing one will be generated automatically.
  identifiers?: Partial<Model['identifiers']>;
};

const model = <const T extends Array<ModelField>>(_model: PublicModel<T>) => {
  return 'test';
};

model({
  slug: 'account',

  fields: [
    {
      slug: 'foo',
      type: 'string',
    },
    {
      slug: 'bar',
      type: 'number',
    },
  ],

  indexes: [
    {
      fields: [
        {
          slug: 'foo',
        },
      ],
    },
  ],
});
