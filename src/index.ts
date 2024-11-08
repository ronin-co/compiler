import type { Query, Statement } from '@/src/types/query';
import type { PublicSchema } from '@/src/types/schema';
import { compileQueryInput } from '@/src/utils';

/**
 * Composes an SQL statement for a provided RONIN query.
 *
 * @param queries - The RONIN queries for which an SQL statement should be composed.
 * @param schemas - A list of schemas.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The composed SQL statement.
 */
export const compileQueries = (
  queries: Array<Query>,
  schemas: Array<PublicSchema>,
  options?: {
    inlineValues?: boolean;
  },
): Array<Statement> => {
  // In order to prevent SQL injections and allow for faster query execution, we're not
  // inserting any values into the SQL statement directly. Instead, we will pass them to
  // SQLite's API later on, so that it can prepare an object that the database can
  // execute in a safe and fast manner. SQLite allows strings, numbers, and booleans to
  // be provided as values.
  const statementValues = options?.inlineValues ? null : [];

  const dependencyStatements: Array<Statement> = [];
  const mainStatements: Array<Statement> = [];

  for (const query of queries) {
    const result = compileQueryInput(query, schemas, statementValues);

    // Every query can only produce one main statement (which can return output), but
    // multiple dependency statements (which must be executed before the main one, but
    // cannot return output themselves). This is essential because of the requirements
    // mentioned below.
    dependencyStatements.push(...result.dependencyStatements);
    mainStatements.push(result.mainStatement);
  }

  // First return all write statements, and then all read statements. This is essential
  // because the write statements aren't expected to produce any output, so they should be
  // executed first. The read statements, on the other hand, are expected to produce
  // output, and that output should be a 1:1 match between RONIN queries and SQL
  // statements, meaning one RONIN query should produce one SQL statement.
  return [...dependencyStatements, ...mainStatements];
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
