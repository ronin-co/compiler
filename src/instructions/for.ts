import type { WithFilters } from '@/src/instructions/with';
import type { GetInstructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { RONIN_SCHEMA_SYMBOLS, RoninError, findInObject } from '@/src/utils/helpers';
import { composeConditions } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `for` query instruction, which allows for quickly
 * adding a number of extra `with` filters to a query.
 *
 * @param schemas - A list of schemas.
 * @param schema - The schema associated with the current query.
 * @param statementValues - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instruction - The `for` instruction provided in the current query.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The SQL syntax for the provided `for` instruction.
 */
export const handleFor = (
  schemas: Array<Schema>,
  schema: Schema,
  statementValues: Array<unknown> | null,
  instruction: GetInstructions['for'],
  rootTable?: string,
) => {
  let statement = '';

  if (!instruction) return statement;

  for (const shortcut in instruction) {
    const args = instruction[shortcut];
    const forFilter = schema.for?.[shortcut];

    if (!forFilter) {
      throw new RoninError({
        message: `The provided \`for\` shortcut "${shortcut}" does not exist in schema "${schema.name}".`,
        code: 'INVALID_FOR_VALUE',
      });
    }

    const replacedForFilter = structuredClone(forFilter);

    findInObject(replacedForFilter, RONIN_SCHEMA_SYMBOLS.VALUE, (match: string) =>
      match.replace(RONIN_SCHEMA_SYMBOLS.VALUE, args),
    );

    const subStatement = composeConditions(
      schemas,
      schema,
      statementValues,
      'for',
      replacedForFilter as WithFilters,
      { rootTable },
    );

    statement += `(${subStatement})`;
  }

  return statement;
};
