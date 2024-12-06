import type { Model, ModelField } from '@/src/types/model';
import type { Instructions } from '@/src/types/query';
import {
  QUERY_SYMBOLS,
  composeIncludedTableAlias,
  flatten,
  getSymbol,
  splitQuery,
} from '@/src/utils/helpers';
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
): { columns: string; isJoining: boolean; loadedFields: Array<ModelField> } => {
  let loadedFields: Array<ModelField> = [];

  let statement = '*';
  let isJoining = false;

  // If additional fields (that are not part of the model) were provided in the
  // `including` instruction, add ephemeral (non-stored) columns for those fields.
  if (instructions.including) {
    // Flatten the object to handle deeply nested ephemeral fields, which are the result
    // of developers providing objects as values in the `including` instruction.
    const flatObject = flatten(instructions.including);

    // Clear the object so we can set fresh keys further below. Clearing the object and
    // setting keys is faster than constructing an entirely new object from the entries
    // of the old object.
    instructions.including = {};

    // Filter out any fields whose value is a sub query, as those fields are instead
    // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
    // sub queries resulting in a single record, is more performance-efficient, and in
    // the case of sub queries resulting in multiple records, it's the only way to
    // include multiple rows of another table.
    for (const [key, value] of Object.entries(flatObject)) {
      const symbol = getSymbol(value);

      if (symbol?.type === 'query') {
        isJoining = true;

        // If the column names should be expanded, that means we need to alias all
        // columns of the joined table to avoid conflicts with the root table.
        if (options?.expandColumns) {
          const { queryModel, queryInstructions } = splitQuery(symbol.value);
          const subQueryModel = getModelBySlug(models, queryModel);
          const tableName = composeIncludedTableAlias(key);

          const queryModelFields = queryInstructions?.selecting
            ? subQueryModel.fields.filter((field) => {
                return queryInstructions.selecting?.includes(field.slug);
              })
            : subQueryModel.fields;

          for (const field of queryModelFields) {
            loadedFields.push({ ...field, parentField: key } as unknown as ModelField);

            const newValue = parseFieldExpression(
              { ...subQueryModel, tableAlias: tableName },
              'including',
              `${QUERY_SYMBOLS.FIELD}${field.slug}`,
            );

            instructions.including![`${tableName}.${field.slug}`] = newValue;
          }
        }

        continue;
      }

      let newValue = value;

      if (symbol?.type === 'expression') {
        newValue = `(${parseFieldExpression(model, 'including', symbol.value)})`;
      } else {
        newValue = prepareStatementValue(statementParams, value);
      }

      instructions.including![key] = newValue;
    }
  }

  const expandColumns = isJoining && options?.expandColumns;

  // If the column names should be expanded, that means we need to alias all columns of
  // the root table to avoid conflicts with columns of joined tables.
  if (expandColumns) {
    instructions.selecting = model.fields.map((field) => field.slug);
  }

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns using `*`.
  if (instructions.selecting) {
    const usableModel = expandColumns
      ? { ...model, tableAlias: model.tableAlias || model.table }
      : model;

    // Reset the list of loaded fields.
    const selectedFields: Array<ModelField> = [];

    statement = instructions.selecting
      .map((slug) => {
        const { field, fieldSelector } = getFieldFromModel(
          usableModel,
          slug,
          'selecting',
        );
        selectedFields.push(field);
        return fieldSelector;
      })
      .join(', ');

    loadedFields = [...selectedFields, ...loadedFields];
  } else {
    loadedFields = [...model.fields, ...loadedFields];
  }

  if (instructions.including && Object.keys(instructions.including).length > 0) {
    statement += ', ';

    // Format the fields into a comma-separated list of SQL columns.
    statement += Object.entries(instructions.including)
      .map(([key, value]) => `${value} as "${key}"`)
      .join(', ');
  }

  return { columns: statement, isJoining, loadedFields };
};
