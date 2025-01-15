import { getFieldFromModel, getModelBySlug } from '@/src/model';
import type { InternalModelField, Model, ModelField } from '@/src/types/model';
import type { Instructions } from '@/src/types/query';
import {
  RAW_FIELD_TYPES,
  type RawFieldType,
  composeIncludedTableAlias,
  flatten,
  getSymbol,
  splitQuery,
} from '@/src/utils/helpers';
import { parseFieldExpression, prepareStatementValue } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `selecting` query instruction, which allows for
 * selecting a list of columns from rows.
 *
 * @param models - A list of models.
 * @param model - The model associated with the current query.
 * @param single - Whether a single or multiple records are being queried.
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
  single: boolean,
  instructions: {
    selecting: Instructions['selecting'];
    including: Instructions['including'];
  },
  options: {
    /** Alias column names that are duplicated when joining multiple tables. */
    expandColumns?: boolean;
  } = {},
): { columns: string; isJoining: boolean; selectedFields: Array<InternalModelField> } => {
  let isJoining = false;

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns using `*`.
  const selectedFields: Array<InternalModelField> = (
    instructions.selecting
      ? instructions.selecting.map((slug) => {
          const { field } = getFieldFromModel(model, slug, {
            instructionName: 'selecting',
          });
          return field;
        })
      : model.fields
  )
    .filter((field: ModelField) => !(field.type === 'link' && field.kind === 'many'))
    .map((field) => {
      const newField: InternalModelField = { ...field, mountingPath: field.slug };

      // If a table alias was set, we need to set the parent field of all loaded fields to
      // the table alias, so that the fields are correctly nested in the output.
      if (model.tableAlias?.startsWith('including_')) {
        const slug = model.tableAlias.replace('including_', '');

        newField.mountingPath = single
          ? `${slug}.${field.slug}`
          : `${slug}[0].${field.slug}`;
      }

      return newField;
    });

  // Expand all columns if specific fields are being selected.
  if (instructions.selecting) options.expandColumns = true;

  const joinedSelectedFields: Array<InternalModelField> = [];
  const joinedColumns: Array<string> = [];

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

      // A JOIN is being performed.
      if (symbol?.type === 'query') {
        const { queryModel, queryInstructions } = splitQuery(symbol.value);
        const subQueryModel = getModelBySlug(models, queryModel);

        // If a sub query was found in the `including` instruction, that means different
        // tables will be joined later on during the compilation of the query.
        isJoining = true;

        // If the sub query selects specific fields, we need to alias the columns of all
        // tables, because we must ensure that only the selected columns of the joined
        // table end up in the final result, which means we cannot use `SELECT *` in the
        // statement, as that would automatically catch all columns of the joined table.
        if (queryInstructions?.selecting) options.expandColumns = true;

        const tableAlias = composeIncludedTableAlias(key);
        const subSingle = queryModel !== subQueryModel.pluralSlug;

        // If multiple records are being joined and the root query only targets a single
        // record, we need to alias the root table, because it will receive a dedicated
        // SELECT statement in the `handleIncluding` function.
        //
        // And even if that's not the case, we need to set an explicit alias in order to
        // ensure that the columns of the root table are selected from the root table,
        // and not from the joined table.
        if (!model.tableAlias)
          model.tableAlias = single && !subSingle ? `sub_${model.table}` : model.table;

        const { columns: nestedColumns, selectedFields: nestedSelectedFields } =
          handleSelecting(
            models,
            { ...subQueryModel, tableAlias },
            statementParams,
            subSingle,
            {
              selecting: queryInstructions?.selecting,
              including: queryInstructions?.including,
            },
            options,
          );

        if (nestedColumns !== '*') joinedColumns.push(nestedColumns);
        joinedSelectedFields.push(...nestedSelectedFields);

        continue;
      }

      let mountedValue = value;

      if (symbol?.type === 'expression') {
        mountedValue = `(${parseFieldExpression(model, 'including', symbol.value)})`;
      } else {
        mountedValue = prepareStatementValue(statementParams, value);
      }

      selectedFields.push({
        slug: key,
        mountingPath: key,
        type: RAW_FIELD_TYPES.includes(typeof value as RawFieldType)
          ? (typeof value as RawFieldType)
          : 'string',
        mountedValue,
      });
    }
  }

  let columns = ['*'];

  // If the column names should be expanded, that means we need to explicitly select the
  // columns of all selected fields.
  //
  // If the column names should not be expanded, we only need to explicitly select the
  // columns of fields that have a custom value, since those are not present in the
  // database, so their value must regardless be exposed via the SQL statement explicitly.
  const fieldsToExpand = options.expandColumns
    ? selectedFields
    : selectedFields.filter(
        (loadedField) => typeof loadedField.mountedValue !== 'undefined',
      );

  const extraColumns = fieldsToExpand.map((selectedField) => {
    if (selectedField.mountedValue) {
      return `${selectedField.mountedValue} as "${selectedField.mountingPath}"`;
    }

    const newTest = selectedField.mountingPath
      .replace(selectedField.slug, '')
      .slice(0, -1);

    // If a table alias was set, we need to set the parent field of all loaded fields to
    // the table alias, so that the fields are correctly nested in the output.
    if (newTest) {
      const { fieldSelector } = getFieldFromModel(model, selectedField.slug, {
        instructionName: 'selecting',
      });

      return `${fieldSelector} as "${model.tableAlias}.${selectedField.slug}"`;
    }

    const { fieldSelector } = getFieldFromModel(model, selectedField.mountingPath, {
      instructionName: 'selecting',
    });

    return fieldSelector;
  });

  if (options.expandColumns) {
    columns = extraColumns;
  } else if (extraColumns) {
    columns.push(...extraColumns);
  }

  columns.push(...joinedColumns);
  selectedFields.push(...joinedSelectedFields);

  return { columns: columns.join(', '), isJoining, selectedFields };
};
