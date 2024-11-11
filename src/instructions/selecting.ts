import type { Instructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { flatten } from '@/src/utils/helpers';
import { getFieldFromSchema } from '@/src/utils/schema';
import { getSubQuery, prepareStatementValue } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `selecting` query instruction, which allows for
 * selecting a list of columns from rows.
 *
 * @param schema - The schema associated with the current query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instructions - The instructions associated with the current query.
 *
 * @returns An SQL string containing the columns that should be selected.
 */
export const handleSelecting = (
  schema: Schema,
  statementParams: Array<unknown> | null,
  instructions: {
    selecting: Instructions['selecting'];
    including: Instructions['including'];
  },
): { columns: string; isJoining: boolean } => {
  let isJoining = false;

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns using `*`.
  let statement = instructions.selecting
    ? instructions.selecting
        .map((slug) => {
          return getFieldFromSchema(schema, slug, 'selecting').fieldSelector;
        })
        .join(', ')
    : '*';

  // If additional fields (that are not part of the schema) were provided in the
  // `including` instruction, add ephemeral (non-stored) columns for those fields.
  if (instructions.including) {
    const filteredObject = Object.entries(instructions.including)
      // Filter out any fields whose value is a sub query, as those fields are instead
      // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
      // sub queries resulting in a single record, is more performance-efficient, and in
      // the case of sub queries resulting in multiple records, it's the only way to
      // include multiple rows of another table.
      .filter(([_, value]) => {
        const hasQuery = getSubQuery(value);
        if (hasQuery) isJoining = true;
        return !hasQuery;
      });

    const newObjectEntries = Object.entries(flatten(Object.fromEntries(filteredObject)));

    if (newObjectEntries.length > 0) {
      statement += ', ';

      statement += newObjectEntries
        // Format the fields into a comma-separated list of SQL columns.
        .map(([key, value]) => {
          return `${prepareStatementValue(statementParams, value)} as "${key}"`;
        })
        .join(', ');
    }
  }

  return { columns: statement, isJoining };
};
