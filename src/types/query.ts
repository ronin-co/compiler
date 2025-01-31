import type {
  InternalModelField,
  ModelField,
  ModelIndex,
  ModelPreset,
  ModelTrigger,
  PublicModel,
} from '@/src/types/model';
import { QUERY_SYMBOLS } from '@/src/utils/helpers';

// Query Types
export type QueryTypeEnum = 'get' | 'set' | 'add' | 'remove' | 'count';
export type ModelQueryTypeEnum = 'create' | 'alter' | 'drop';
export type ModelEntityEnum = 'field' | 'index' | 'trigger' | 'preset';

// Field and Expressions
export type FieldValue = string | number | boolean | null | unknown;
export type FieldSelector = Record<string, FieldValue | StoredObject>;

export type StoredObject = {
  key: string;
  src: string;
  name: string | null;
  placeholder: {
    base64: string | null;
  } | null;
  meta: {
    size: number;
    type: string;
    width?: number;
    height?: number;
  };
};

export type Expression = {
  [QUERY_SYMBOLS.EXPRESSION]: string;
};

// With Instructions
export type WithInstructionRefinement =
  | FieldValue
  | {
      being?: FieldValue | Array<FieldValue>;
      notBeing?: FieldValue | Array<FieldValue>;

      startingWith?: FieldValue | Array<FieldValue>;
      notStartingWith?: FieldValue | Array<FieldValue>;

      endingWith?: FieldValue | Array<FieldValue>;
      notEndingWith?: FieldValue | Array<FieldValue>;

      containing?: FieldValue | Array<FieldValue>;
      notContaining?: FieldValue | Array<FieldValue>;

      greaterThan?: FieldValue | Array<FieldValue>;
      greaterOrEqual?: FieldValue | Array<FieldValue>;

      lessThan?: FieldValue | Array<FieldValue>;
      lessOrEqual?: FieldValue | Array<FieldValue>;
    };

export type WithInstruction =
  | Record<string, WithInstructionRefinement>
  | Record<string, Record<string, WithInstructionRefinement>>
  | Record<string, Array<WithInstructionRefinement>>
  | Record<string, Record<string, Array<WithInstructionRefinement>>>;

// Including Instructions
export type IncludingInstruction = Record<string, unknown | GetQuery>;

// Ordering Instructions
export type OrderedByInstruction = {
  ascending?: Array<string | Expression>;
  descending?: Array<string | Expression>;
};

// Using Instructions
export type UsingInstruction = Array<string> | Record<string, string>;

// Query Instructions
export type CombinedInstructions = {
  with?: WithInstruction | Array<WithInstruction>;
  to?: FieldSelector;
  including?: IncludingInstruction;
  selecting?: Array<string>;
  orderedBy?: OrderedByInstruction;
  before?: string | null;
  after?: string | null;
  limitedTo?: number;
  using?: UsingInstruction;
};

export type InstructionSchema =
  | 'with'
  | 'to'
  | 'including'
  | 'selecting'
  | 'orderedBy'
  | 'orderedBy.ascending'
  | 'orderedBy.descending'
  | 'before'
  | 'after'
  | 'limitedTo'
  | 'using';

// Query Types
export type GetQuery = Record<string, Omit<CombinedInstructions, 'to'> | null>;
export type SetQuery = Record<
  string,
  Omit<CombinedInstructions, 'to'> & { to: FieldSelector }
>;
export type AddQuery = Record<
  string,
  Omit<CombinedInstructions, 'with' | 'using'> & { with: FieldSelector }
>;
export type RemoveQuery = Record<string, Omit<CombinedInstructions, 'to'>>;
export type CountQuery = Record<string, Omit<CombinedInstructions, 'to'> | null>;

// Individual Instructions
export type GetInstructions = Omit<CombinedInstructions, 'to'>;
export type SetInstructions = Omit<CombinedInstructions, 'to'> & { to: FieldSelector };
export type AddInstructions = Omit<CombinedInstructions, 'with' | 'using'> & {
  to: FieldSelector;
};
export type RemoveInstructions = Omit<CombinedInstructions, 'to'>;
export type CountInstructions = Omit<CombinedInstructions, 'to'>;
export type Instructions =
  | GetInstructions
  | SetInstructions
  | AddInstructions
  | RemoveInstructions
  | CountInstructions;

export type CreateQuery = {
  model: string | PublicModel;
  to?: PublicModel;
};

export type AlterQuery = {
  model: string;
  to?: Partial<
    Omit<PublicModel, 'fields' | 'indexes' | 'triggers' | 'presets' | 'idPrefix'>
  >;
  create?: {
    field?: ModelField;
    index?: ModelIndex;
    trigger?: ModelTrigger;
    preset?: ModelPreset;
  };
  alter?:
    | {
        field?: string;
        to?: Partial<ModelField>;
      }
    | {
        index?: string;
        to?: Partial<ModelIndex>;
      }
    | {
        trigger?: string;
        to?: Partial<ModelTrigger>;
      }
    | {
        preset?: string;
        to?: Partial<ModelPreset>;
      };
  drop?: Partial<Record<ModelEntityEnum, string>>;
};

export type DropQuery = {
  model: string;
};

// Model Queries
export type ModelQuery =
  | {
      create: CreateQuery;
    }
  | {
      alter: AlterQuery;
    }
  | {
      drop: DropQuery;
    };

// Pagination Options
export type QueryPaginationOptions = {
  moreBefore?: string | null;
  moreAfter?: string | null;
};

export type Query = {
  get?: GetQuery;
  set?: SetQuery;
  add?: AddQuery;
  remove?: RemoveQuery;
  count?: CountQuery;

  create?: CreateQuery;
  alter?: AlterQuery;
  drop?: DropQuery;
};

// Utility Types
export type QueryType = QueryTypeEnum | ModelQueryTypeEnum;
export type QueryInstructionType = InstructionSchema;
export type QuerySchemaType = Partial<Record<string, Partial<CombinedInstructions>>>;
export type ModelQueryType = ModelQueryTypeEnum;
export type ModelEntityType = ModelEntityEnum;

export interface Statement {
  statement: string;
  params: Array<unknown>;
  returning?: boolean;
}

export interface InternalStatement extends Statement {
  query: Query;
  selectedFields: Array<InternalModelField>;
}

export interface InternalDependencyStatement extends Statement {
  /**
   * By default, the dependency statement is run before the main statement. By setting
   * `after` to `true`, the dependency statement is run after the main statement instead.
   */
  after?: boolean;
}
