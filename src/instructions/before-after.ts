import type { GetInstructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { RoninError } from '@/src/utils/helpers';
import { getFieldFromSchema } from '@/src/utils/schema';
import { prepareStatementValue } from '@/src/utils/statement';

// The separator and NULL placeholder have to be somewhat unique so that they don't
// conflict with any other row values that might be used in the cursor.
export const CURSOR_SEPARATOR = ',';
export const CURSOR_NULL_PLACEHOLDER = 'RONIN_NULL';

/**
 * Generates SQL syntax for the `before` or `after` query instructions, which are used
 * for paginating a list of records.
 *
 * Specifically, the values of `before` and `after` should be derived from the
 * `moreBefore` and `moreAfter` properties available on a list of records
 * retrieved from RONIN.
 *
 * @param schema - The schema being addressed in the query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instructions - The instructions associated with the current query.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The SQL syntax for the provided `before` or `after` instruction.
 */
export const handleBeforeOrAfter = (
  schema: Schema,
  statementParams: Array<unknown> | null,
  instructions: {
    before?: GetInstructions['before'];
    after?: GetInstructions['after'];
    with?: GetInstructions['with'];
    orderedBy: GetInstructions['orderedBy'];
  },
  rootTable?: string,
): string => {
  if (!(instructions.before || instructions.after)) {
    throw new RoninError({
      message: 'The `before` or `after` instruction must not be empty.',
      code: 'MISSING_INSTRUCTION',
      queries: null,
    });
  }

  if (instructions.before && instructions.after) {
    throw new RoninError({
      message: 'The `before` and `after` instructions cannot co-exist. Choose one.',
      code: 'MUTUALLY_EXCLUSIVE_INSTRUCTIONS',
      queries: null,
    });
  }

  const { ascending = [], descending = [] } = instructions.orderedBy || {};
  const clause = instructions.with ? 'AND ' : '';

  // @ts-expect-error Above we are already making sure that either `before` or
  // `after` is defined.
  const chunks = (instructions.before || instructions.after)
    .toString()
    .split(CURSOR_SEPARATOR)
    .map(decodeURIComponent);
  const keys = [...ascending, ...descending];
  const values = keys.map((key, index) => {
    const value = chunks[index];

    if (value === CURSOR_NULL_PLACEHOLDER) {
      return 'NULL';
    }

    const { field } = getFieldFromSchema(schema, key, 'orderedBy');

    if (field.type === 'boolean') {
      return prepareStatementValue(statementParams, value === 'true');
    }

    if (field.type === 'number') {
      return prepareStatementValue(statementParams, Number.parseInt(value));
    }

    if (field.type === 'date') {
      // We're intentionally not using `prepareStatementValue` here, because it's easier
      // to debug an SQL query when the date is in a readable format.
      return `'${new Date(Number.parseInt(value)).toJSON()}'`;
    }

    return prepareStatementValue(statementParams, value);
  });

  const compareOperators: Array<'>' | '<'> = [
    // Reverse the comparison operators if we're querying for records before.
    ...new Array(ascending.length).fill(instructions.before ? '<' : '>'),
    ...new Array(descending.length).fill(instructions.before ? '>' : '<'),
  ];

  // This array will hold all the conditions of the WHERE or AND clause.
  const conditions = new Array<string>();

  // Iterate over all the fields used for ordering.
  for (let i = 0; i < keys.length; i++) {
    // We don't want to compare "isLessThan" with NULL because that's impossible to do,
    // since there's nothing lower than NULL. We simply fall back to the next field in
    // the next condition.
    if (values[i] === 'NULL' && compareOperators[i] === '<') {
      continue;
    }

    // This array will hold the parts of a single condition.
    const condition = new Array<string>();

    // Iterate from the first field to the current one.
    for (let j = 0; j <= i; j++) {
      const key = keys[j];
      const value = values[j];

      let { field, fieldSelector } = getFieldFromSchema(
        schema,
        key,
        'orderedBy',
        rootTable,
      );

      // If we're at the current field, add the comparison to the condition.
      if (j === i) {
        // We have to close the parentheses because the previous conditions have left
        // them open.
        const closingParentheses = ')'.repeat(condition.length);
        const operator = value === 'NULL' ? 'IS NOT' : compareOperators[j];

        // It does not make sense to ask for case-insensitive ordering when the value is
        // NULL because we use IS and IS NOT instead of other comparison operators.
        const caseInsensitiveStatement =
          value !== 'NULL' && field.type === 'string' ? ' COLLATE NOCASE' : '';

        // If the column value is NULL, the < operator ignores that row because comparing
        // anything to NULL always results in UNKNOWN, which is interpreted as FALSE.
        // Instead, we coalesce the value to the lowest value possible.
        //
        // Also skip this for `ronin.createdAt` and `ronin.updatedAt` because we know
        // that those are not nullable.
        if (
          value !== 'NULL' &&
          operator === '<' &&
          !['ronin.createdAt', 'ronin.updatedAt'].includes(key)
        ) {
          fieldSelector = `IFNULL(${fieldSelector}, -1e999)`;
        }

        condition.push(
          `(${fieldSelector} ${operator} ${value}${caseInsensitiveStatement})${closingParentheses}`,
        );
      }
      // If we're at a previous field, add the equality check to the condition.
      else {
        const operator = value === 'NULL' ? 'IS' : '=';
        condition.push(`(${fieldSelector} ${operator} ${value} AND`);
      }
    }

    conditions.push(condition.join(' '));
  }

  return `${clause}(${conditions.join(' OR ')})`;
};
