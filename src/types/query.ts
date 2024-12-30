import type { ModelField } from '@/src/types/model';
import type { Query } from '@/src/validators/query';
export type * from '@/src/validators/query';

export interface Statement {
  statement: string;
  params: Array<unknown>;
  returning?: boolean;
}

export interface InternalStatement extends Statement {
  query: Query;
  fields: Array<ModelField>;
}
