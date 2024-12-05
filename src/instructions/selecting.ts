import type { Model } from '@/src/types/model';
import type { Instructions } from '@/src/types/query';
import { flatten, splitQuery } from '@/src/utils/helpers';
import { getFieldFromModel } from '@/src/utils/model';
import {
  getSymbol,
  parseFieldExpression,
  prepareStatementValue,
} from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `selecting` query instruction, which allows for
 * selecting a list of columns from rows.
 *
 * @param model - The model associated with the current query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instructions - The instructions associated with the current query.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL string containing the columns that should be selected.
 */
export const handleSelecting = (
  model: Model,
  statementParams: Array<unknown> | null,
  instructions: {
    selecting: Instructions['selecting'];
    including: Instructions['including'];
  },
  options?: {
    /** Alias column names that are duplicated when joining multiple tables. */
    expandColumns?: boolean;
  },
): { columns: string; isJoining: boolean } => {
  // A map of table names to be joined (keys) and their respecptive model slugs (values).
  const includedTables = new Map<string, string>();

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns using `*`.
  let statement = instructions.selecting
    ? instructions.selecting
        .map((slug) => {
          return getFieldFromModel(model, slug, 'selecting').fieldSelector;
        })
        .join(', ')
    : '*';

  // If additional fields (that are not part of the model) were provided in the
  // `including` instruction, add ephemeral (non-stored) columns for those fields.
  if (instructions.including) {
    // Filter out any fields whose value is a sub query, as those fields are instead
    // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
    // sub queries resulting in a single record, is more performance-efficient, and in
    // the case of sub queries resulting in multiple records, it's the only way to
    // include multiple rows of another table.
    const filteredObject = Object.entries(instructions.including)
      .map(([key, value]) => {
        const symbol = getSymbol(value);

        if (symbol) {
          if (symbol.type === 'query') {
            const { queryModel } = splitQuery(symbol.value);
            includedTables.set(`including_${key}`, queryModel);
            return null;
          }

          if (symbol.type === 'expression') {
            value = parseFieldExpression(model, 'including', symbol.value);
          }
        }

        return [key, value];
      })
      .filter((entry) => entry !== null);

    // Flatten the object to handle deeply nested ephemeral fields, which are the result
    // of developers providing objects as values in the `including` instruction.
    const newObjectEntries = Object.entries(flatten(Object.fromEntries(filteredObject)));

    if (newObjectEntries.length > 0) {
      statement += ', ';

      statement += newObjectEntries
        // Format the fields into a comma-separated list of SQL columns.
        .map(([key, value]) => {
          if (typeof value === 'string' && value.startsWith('"'))
            return `(${value}) as "${key}"`;
          return `${prepareStatementValue(statementParams, value)} as "${key}"`;
        })
        .join(', ');
    }
  }

  return { columns: statement, isJoining: includedTables.size > 0 };
};
