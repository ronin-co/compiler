import type { Model, ModelField } from '@/src/types/model';
import type { Instructions } from '@/src/types/query';
import {
  QUERY_SYMBOLS,
  RAW_FIELD_TYPES,
  type RawFieldType,
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
  let expandColumns = false;

  let statement = '*';
  let isJoining = false;

  // If additional fields (that are not part of the model) were provided in the
  // `including` instruction, add ephemeral (non-stored) columns for those fields.
  if (instructions.including) {
    // Flatten the object to handle deeply nested ephemeral fields, which are the result
    // of developers providing objects as values in the `including` instruction.
    const flatObject = flatten(instructions.including);

    // Clear the object so we can set fresh keys further below. Clearing the object and
    // setting keys is faster than constructing an entirely new object from arrays of
    // values that were previously mapped over.
    instructions.including = {};

    // Filter out any fields whose value is a sub query, as those fields are instead
    // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
    // sub queries resulting in a single record, is more performance-efficient, and in
    // the case of sub queries resulting in multiple records, it's the only way to
    // include multiple rows of another table.
    for (const [key, value] of Object.entries(flatObject)) {
      const symbol = getSymbol(value);

      if (symbol?.type === 'query') {
        const { queryModel, queryInstructions } = splitQuery(symbol.value);
        const subQueryModel = getModelBySlug(models, queryModel);

        // If a sub query was found in the `including` instruction, that means different
        // tables will be joined later on during the compilation of the query.
        isJoining = true;

        // If a sub query was found in the `including` instruction, that also means we
        // should alias the columns of all tables if the compiler was instructed to do so
        // using the respective config option.
        //
        // Additionally, if the sub query selects specific fields, we also need to alias
        // the columns of all tables, because we must ensure that only the selected
        // columns of the joined table end up in the final result, which means we cannot
        // use `SELECT *` in the SQL statement, as that would automatically catch all
        // columns of the joined table.
        expandColumns = Boolean(options?.expandColumns || queryInstructions?.selecting);

        const tableAlias = composeIncludedTableAlias(key);
        const single = queryModel !== subQueryModel.pluralSlug;

        // If multiple records are being joined and the root query only targets a single
        // record, we need to alias the root table, because it will receive a dedicated
        // SELECT statement in the `handleIncluding` function.
        if (!single) {
          model.tableAlias = `sub_${model.table}`;
        }

        const queryModelFields = queryInstructions?.selecting
          ? subQueryModel.fields.filter((field) => {
              return queryInstructions.selecting?.includes(field.slug);
            })
          : // Exclude link fields with cardinality "many", since those don't exist as columns.
            subQueryModel.fields.filter((field) => {
              return !(field.type === 'link' && field.kind === 'many');
            });

        for (const field of queryModelFields) {
          loadedFields.push({ ...field, parentField: key } as unknown as ModelField);

          // If the column names should be expanded, that means we need to alias all
          // columns of the joined table to avoid conflicts with the root table.
          if (expandColumns) {
            const newValue = parseFieldExpression(
              { ...subQueryModel, tableAlias },
              'including',
              `${QUERY_SYMBOLS.FIELD}${field.slug}`,
            );

            instructions.including![`${tableAlias}.${field.slug}`] = newValue;
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

      loadedFields.push({
        slug: key,
        type: RAW_FIELD_TYPES.includes(typeof value as RawFieldType)
          ? (typeof value as RawFieldType)
          : 'string',
      });
    }
  }

  // If the column names should be expanded, that means we need to alias all columns of
  // the root table to avoid conflicts with columns of joined tables.
  if (expandColumns) {
    instructions.selecting = model.fields
      // Exclude link fields with cardinality "many", since those don't exist as columns.
      .filter((field) => !(field.type === 'link' && field.kind === 'many'))
      .map((field) => field.slug);
  }

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns using `*`.
  if (instructions.selecting) {
    const usableModel = expandColumns
      ? { ...model, tableAlias: model.tableAlias || model.table }
      : model;

    // The model fields that were selected by the root query.
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
    loadedFields = [
      ...model.fields.filter(
        (field) => !(field.type === 'link' && field.kind === 'many'),
      ),
      ...loadedFields,
    ];
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
