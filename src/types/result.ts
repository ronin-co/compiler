import type { Model, ModelField } from '@/src/types/model';

export type RawRow = Array<unknown>;
export type ObjectRow = Record<string, unknown>;

export type Row = RawRow | ObjectRow;

export type ResultRecord = Record<string, unknown> & {
  id: string;
  ronin: {
    locked: boolean;
    createdAt: string;
    createdBy: string | null;
    updatedAt: string;
    updatedBy: string | null;
  };
};

export type SingleRecordResult<T = ResultRecord> = {
  record: T | null;

  modelFields: Record<ModelField['slug'], ModelField['type']>;
};

export type MultipleRecordResult<T = ResultRecord> = {
  records: Array<T>;
  moreAfter?: string;
  moreBefore?: string;

  modelFields: Record<ModelField['slug'], ModelField['type']>;
};

export type AmountResult = {
  amount: number;
};

export type RegularResult<T = ResultRecord> =
  | SingleRecordResult<T>
  | MultipleRecordResult<T>
  | AmountResult;

export type ExpandedResult<T = ResultRecord> = Record<Model['slug'], RegularResult<T>>;

export type Result<T = ResultRecord> = RegularResult<T> | ExpandedResult<T>;
