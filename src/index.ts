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
export const compileQueries = (
  query: Query,
  schemas: Array<PublicSchema>,
  options?: {
    inlineValues?: boolean;
  },
) => {
  // In order to prevent SQL injections and allow for faster query execution, we're not
  // inserting any values into the SQL statement directly. Instead, we will pass them to
  // SQLite's API later on, so that it can prepare an object that the database can
  // execute in a safe and fast manner. SQLite allows strings, numbers, and booleans to
  // be provided as values.
  const statementValues = options?.inlineValues ? null : [];

  return compileQueryInput(query, schemas, statementValues);
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
