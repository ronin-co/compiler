import type { Query } from '@/src/types/query';
import type { PublicSchema } from '@/src/types/schema';
import { compileQueryInput } from '@/src/utils';

/**
 * Composes an SQL statement for a provided RONIN query.
 *
 * @param query - The RONIN query for which an SQL statement should be composed.
 * @param schemas - A list of schemas.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The composed SQL statement.
 */
export const compileQuery = (
  query: Query,
  defaultSchemas: Array<PublicSchema>,
  options?: {
    inlineValues?: boolean;
  },
) => {
  return compileQueryInput(query, defaultSchemas, {
    inlineValues: options?.inlineValues,
  });
};

// Expose schema types
export type {
  PublicSchema as Schema,
  SchemaField,
  SchemaIndex,
  SchemaTrigger,
} from '@/src/types/schema';

// Expose query types
export * from '@/src/types/query';
