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

export type SchemaFieldReference = SchemaFieldBasics & {
  type: 'reference';
  target: string;
  kind?: 'one' | 'many';
};

export type SchemaField = SchemaFieldNormal | SchemaFieldReference;

export interface Schema {
  name?: string;
  pluralName?: string;
  slug: string;
  pluralSlug: string;
  identifiers?: {
    title?: string;
    slug?: string;
  };
  fields?: Array<SchemaField>;
  idPrefix?: string;

  including?: Record<string, Query>;
  for?: Record<string, WithInstruction>;
}
