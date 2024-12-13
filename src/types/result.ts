import type { ModelField } from '@/src/types/model';

export type RawRow = Array<unknown>;
export type ObjectRow = Record<string, unknown>;

export type Row = RawRow | ObjectRow;

export type NativeRecord = Record<string, unknown> & {
  id: string;
  ronin: {
    locked: boolean;
    createdAt: string;
    createdBy: string | null;
    updatedAt: string;
    updatedBy: string | null;
  };
};

export type SingleRecordResult<T = NativeRecord> = {
  record: T | null;

  modelFields: Record<ModelField['slug'], ModelField['type']>;
};

export type MultipleRecordResult = {
  records: Array<NativeRecord>;
  moreAfter?: string;
  moreBefore?: string;

  modelFields: Record<ModelField['slug'], ModelField['type']>;
};

export type AmountResult = {
  amount: number;
};

export type Result = SingleRecordResult | MultipleRecordResult | AmountResult;
