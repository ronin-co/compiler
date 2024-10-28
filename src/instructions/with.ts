import type { GetInstructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { composeConditions } from '@/src/utils/statement';

const WITH_CONDITIONS = [
  'being',
  'notBeing',
  'startingWith',
  'notStartingWith',
  'endingWith',
  'notEndingWith',
  'containing',
  'notContaining',
  'greaterThan',
  'greaterOrEqual',
  'lessThan',
  'lessOrEqual',
] as const;

type WithCondition = (typeof WITH_CONDITIONS)[number];

type WithValue = string | number | null;
type WithValueOptions = WithValue | Array<WithValue>;
type WithFilters = Record<WithCondition, WithValueOptions>;

export type { WithValue, WithValueOptions, WithFilters, WithCondition };
export { WITH_CONDITIONS };

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
