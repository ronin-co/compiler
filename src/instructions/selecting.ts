import type { Model } from '@/src/types/model';
import type { Instructions } from '@/src/types/query';
import { RONIN_MODEL_SYMBOLS, flatten, getSymbol, splitQuery } from '@/src/utils/helpers';
import { getFieldFromModel, getModelBySlug } from '@/src/utils/model';
import { parseFieldExpression, prepareStatementValue } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `selecting` query instruction, which allows for
 * selecting a list of columns from rows.
 *
 * @param models - A list of models.
 * @param model - The model associated with the current query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instructions - The instructions associated with the current query.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL string containing the columns that should be selected.
 */
export const handleSelecting = (
  models: Array<Model>,
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
  let isJoining = false;

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
    // Flatten the object to handle deeply nested ephemeral fields, which are the result
    // of developers providing objects as values in the `including` instruction.
    const flatObject = flatten(instructions.including);

    // Filter out any fields whose value is a sub query, as those fields are instead
    // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
    // sub queries resulting in a single record, is more performance-efficient, and in
    // the case of sub queries resulting in multiple records, it's the only way to
    // include multiple rows of another table.
    const filteredObject: Array<[string, unknown]> = Object.entries(flatObject)
      .flatMap(([key, value]) => {
        const symbol = getSymbol(value);

        if (symbol?.type === 'query') {
          isJoining = true;

          // If the column names should be expanded, that means we need to alias all
          // columns of the joined table if those column names are duplicated in the
          // current table.
          if (!options?.expandColumns) return null;

          const { queryModel: queryModelSlug } = splitQuery(symbol.value);
          const queryModel = getModelBySlug(models, queryModelSlug);
          const tableName = `including_${key}`;

          const duplicatedFields = queryModel.fields
            .filter((field) => {
              if (field.type === 'group') return null;
              return model.fields.some((modelField) => modelField.slug === field.slug);
            })
            .filter((item) => item !== null);

          return duplicatedFields.map((field) => {
            const value = parseFieldExpression(
              { ...queryModel, tableAlias: tableName },
              'including',
              `${RONIN_MODEL_SYMBOLS.FIELD}${field.slug}`,
            );

            return {
              key: `${tableName}.${field.slug}`,
              value,
            };
          });
        }

        if (symbol?.type === 'expression') {
          value = `(${parseFieldExpression(model, 'including', symbol.value)})`;
        } else {
          value = prepareStatementValue(statementParams, value);
        }

        return { key, value };
      })
      .filter((entry) => entry !== null)
      .map((entry) => [entry.key, entry.value]);

    if (filteredObject.length > 0) {
      statement += ', ';

      // Format the fields into a comma-separated list of SQL columns.
      statement += filteredObject

        .map(([key, value]) => `${value} as "${key}"`)
        .join(', ');
    }
  }

  return { columns: statement, isJoining };
};
