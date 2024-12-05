export type RawRow = Array<unknown>;
export type ObjectRow = Record<string, unknown>;

export type Row = RawRow | ObjectRow;

export type NativeRecord = Record<string, unknown> & {
  id: string;
  ronin: {
    createdAt: Date;
    updatedAt: Date;
  };
};

export type SingleRecordResult = {
  record: NativeRecord | null;
};

export type MultipleRecordResult = {
  records: Array<NativeRecord>;
  moreAfter?: string;
  moreBefore?: string;
};

export type AmountResult = {
  amount: number;
};

export type Result = SingleRecordResult | MultipleRecordResult | AmountResult;
