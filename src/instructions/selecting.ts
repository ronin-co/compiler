import { getFieldFromModel, getModelBySlug } from '@/src/model';
import type { InternalModelField, Model, ModelField } from '@/src/types/model';
import type { Instructions } from '@/src/types/query';
import {
  QUERY_SYMBOLS,
  RAW_FIELD_TYPES,
  type RawFieldType,
  composeMountingPath,
  flatten,
  getQuerySymbol,
  splitQuery,
} from '@/src/utils/helpers';
import {
  filterSelectedFields,
  parseFieldExpression,
  prepareStatementValue,
} from '@/src/utils/statement';

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
    /** The path on which the selected fields should be mounted in the final record. */
    mountingPath?: InternalModelField['mountingPath'];
  } = {},
): { columns: string; isJoining: boolean; selectedFields: Array<InternalModelField> } => {
  let isJoining = false;

  // If specific fields were provided in the `selecting` instruction, select only the
  // columns of those fields. Otherwise, select all columns.
  const selectedFields: Array<InternalModelField> = filterSelectedFields(
    model,
    instructions.selecting,
  )
    .filter((field: ModelField) => !(field.type === 'link' && field.kind === 'many'))
    .map((field) => {
      const newField: InternalModelField = { ...field, mountingPath: field.slug };

      if (options.mountingPath) {
        // Remove all occurrences of `{n}`, which are used to indicate the index of a join
        // that is being performed on the same nesting level of a record. Meaning if, for
        // example, multiple different tables are being joined and their outputs must all
        // be mounted on the same property of a record, `{n}` contains the index of the
        // join (whether it is the first join, the second one, or so on).
        newField.mountingPath = `${options.mountingPath.replace(/\{\d+\}/g, '')}.${field.slug}`;
      }

      return newField;
    });

  const joinedSelectedFields: Array<InternalModelField> = [];
  const joinedColumns: Array<string> = [];

  // If additional fields (that are not part of the model) were provided in the
  // `including` instruction, add ephemeral (non-stored) columns for those fields.
  if (instructions.including) {
    const symbol = getQuerySymbol(instructions.including);

    if (symbol?.type === 'query') {
      instructions.including.ronin_root = { ...instructions.including };
      delete instructions.including[QUERY_SYMBOLS.QUERY];
    }

    // Flatten the object to handle deeply nested ephemeral fields, which are the result
    // of developers providing objects as values in the `including` instruction.
    const flatObject = flatten(instructions.including);

    // Filter out any fields whose value is a sub query, as those fields are instead
    // converted into SQL JOINs in the `handleIncluding` function, which, in the case of
    // sub queries resulting in a single record, is more performance-efficient, and in
    // the case of sub queries resulting in multiple records, it's the only way to
    // include multiple rows of another table.
    for (const [key, value] of Object.entries(flatObject)) {
      const symbol = getQuerySymbol(value);

      // A JOIN is being performed.
      if (symbol?.type === 'query') {
        const { queryModel, queryInstructions } = splitQuery(symbol.value);
        const subQueryModel = getModelBySlug(models, queryModel);

        // If a sub query was found in the `including` instruction, that means different
        // tables will be joined later on during the compilation of the query.
        isJoining = true;

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

        const { tableAlias, subMountingPath } = composeMountingPath(
          subSingle,
          key,
          options.mountingPath,
        );

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
            { ...options, mountingPath: subMountingPath },
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

  const columns = selectedFields.map((selectedField) => {
    if (selectedField.mountedValue) {
      return `${selectedField.mountedValue} as "${selectedField.slug}"`;
    }

    const { fieldSelector } = getFieldFromModel(model, selectedField.slug, {
      instructionName: 'selecting',
    });

    if (options.mountingPath) {
      return `${fieldSelector} as "${options.mountingPath}.${selectedField.slug}"`;
    }

    return fieldSelector;
  });

  columns.push(...joinedColumns);
  selectedFields.push(...joinedSelectedFields);

  return { columns: columns.join(', '), isJoining, selectedFields };
};
