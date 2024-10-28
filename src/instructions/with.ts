import type { GetInstructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { composeConditions } from '@/src/utils/statement';

/**
 * Determines the right SQL assertion syntax for a given value.
 *
 * @param value - The value to be asserted.
 * @param negative - Whether the assertion should be negative.
 *
 * @returns The SQL assertion syntax for the given value.
 */
const getMatcher = (value: unknown, negative: boolean): string => {
  if (negative) {
    if (value === null) return 'IS NOT';
    return '!=';
  }

  if (value === null) return 'IS';
  return '=';
};

export const WITH_CONDITIONS = {
  being: (value: unknown, baseValue: unknown) =>
    `${getMatcher(baseValue, false)} ${value}`,
  notBeing: (value: unknown, baseValue: unknown) =>
    `${getMatcher(baseValue, true)} ${value}`,

  startingWith: (value: unknown) => `LIKE ${value}%`,
  notStartingWith: (value: unknown) => `NOT LIKE ${value}%`,

  endingWith: (value: unknown) => `LIKE %${value}`,
  notEndingWith: (value: unknown) => `NOT LIKE %${value}`,

  containing: (value: unknown) => `LIKE %${value}%`,
  notContaining: (value: unknown) => `NOT LIKE %${value}%`,

  greaterThan: (value: unknown) => `> ${value}`,
  greaterOrEqual: (value: unknown) => `>= ${value}`,

  lessThan: (value: unknown) => `< ${value}`,
  lessOrEqual: (value: unknown) => `<= ${value}`,
};

type WithCondition = keyof typeof WITH_CONDITIONS;

type WithValue = string | number | null;
type WithValueOptions = WithValue | Array<WithValue>;
type WithFilters = Record<WithCondition, WithValueOptions>;

export type { WithValue, WithValueOptions, WithFilters, WithCondition };

/**
 * Generates the SQL syntax for the `with` query instruction, which allows for filtering
 * the records that should be addressed.
 *
 * @param schemas - A list of schemas.
 * @param schema - The schema being addressed in the query.
 * @param statementValues - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instruction - The `with` instruction included in a query.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The SQL syntax for the provided `with` instruction.
 */
export const handleWith = (
  schemas: Array<Schema>,
  schema: Schema,
  statementValues: Array<unknown>,
  instruction: GetInstructions['with'],
  rootTable?: string,
): string => {
  const subStatement = composeConditions(
    schemas,
    schema,
    statementValues,
    'with',
    instruction as WithFilters,
    { rootTable },
  );

  return `(${subStatement})`;
};
