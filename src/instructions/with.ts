import type { Model } from '@/src/types/model';
import type { GetInstructions } from '@/src/types/query';
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
  being: (value) => [getMatcher(value, false), value],
  notBeing: (value) => [getMatcher(value, true), value],

  startingWith: (value) => ['LIKE', `${value}%`],
  notStartingWith: (value) => ['NOT LIKE', `${value}%`],

  endingWith: (value) => ['LIKE', `%${value}`],
  notEndingWith: (value) => ['NOT LIKE', `%${value}`],

  containing: (value) => ['LIKE', `%${value}%`],
  notContaining: (value) => ['NOT LIKE', `%${value}%`],

  greaterThan: (value) => ['>', value],
  greaterOrEqual: (value) => ['>=', value],

  lessThan: (value) => ['<', value],
  lessOrEqual: (value) => ['<=', value],
} satisfies Record<string, WithMatcher>;

type WithMatcher = (value: unknown) => [string, unknown];
type WithCondition = keyof typeof WITH_CONDITIONS;

type WithValue = string | number | null;
type WithValueOptions = WithValue | Array<WithValue>;
type WithFilters = Record<WithCondition, WithValueOptions>;

export type { WithValue, WithValueOptions, WithFilters, WithCondition };

/**
 * Generates the SQL syntax for the `with` query instruction, which allows for filtering
 * the records that should be addressed.
 *
 * @param models - A list of models.
 * @param model - The model associated with the current query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instruction - The `with` instruction included in a query.
 * @param parentModel - The model of the parent query, if there is one.
 *
 * @returns The SQL syntax for the provided `with` instruction.
 */
export const handleWith = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  instruction: GetInstructions['with'],
  parentModel?: Model,
): string => {
  const subStatement = composeConditions(
    models,
    model,
    statementParams,
    'with',
    instruction as WithFilters,
    { parentModel },
  );

  return `(${subStatement})`;
};
