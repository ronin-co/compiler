export type Row = Record<string, unknown>;

export type NativeRecord = Record<string, unknown> & {
  id: string;
  ronin: {
    createdAt: Date;
    updatedAt: Date;
  };
};

type SingleRecordResult = {
  record: NativeRecord | null;
};

type MultipleRecordResult = {
  records: Array<NativeRecord>;
  moreAfter?: string;
  moreBefore?: string;
};

type AmountResult = {
  amount: number;
};

export type Result = SingleRecordResult | MultipleRecordResult | AmountResult;
