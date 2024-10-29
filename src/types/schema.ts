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

export type SchemaFieldReferenceAction =
  | 'CASCADE'
  | 'RESTRICT'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'NO ACTION';

export type SchemaFieldReference = SchemaFieldBasics & {
  type: 'reference';

  // Make the `pluralSlug` required.
  target: Omit<Partial<Schema>, 'pluralSlug'> & Pick<Schema, 'pluralSlug'>;

  kind?: 'one' | 'many';
  actions?: {
    onDelete?: SchemaFieldReferenceAction;
    onUpdate?: SchemaFieldReferenceAction;
  };
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
