import { handleBeforeOrAfter } from '@/src/instructions/before-after';
import { handleFor } from '@/src/instructions/for';
import { handleIncluding } from '@/src/instructions/including';
import { handleLimitedTo } from '@/src/instructions/limited-to';
import { handleOrderedBy } from '@/src/instructions/ordered-by';
import { handleSelecting } from '@/src/instructions/selecting';
import { handleTo } from '@/src/instructions/to';
import { handleWith } from '@/src/instructions/with';
import type { Model, ModelField } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import { RoninError, isObject, splitQuery } from '@/src/utils/helpers';
import { getModelBySlug, transformMetaQuery } from '@/src/utils/model';
import { formatIdentifiers } from '@/src/utils/statement';

/**
 * Composes an SQL statement for a provided RONIN query.
 *
 * @param query - The RONIN query for which an SQL statement should be composed.
 * @param models - A list of models.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The composed SQL statement.
 */
export const compileQueryInput = (
  defaultQuery: Query,
  models: Array<Model>,
  // In order to prevent SQL injections and allow for faster query execution, we're not
  // inserting any values into the SQL statement directly. Instead, we will pass them to
  // SQLite's API later on, so that it can prepare an object that the database can
  // execute in a safe and fast manner. SQLite allows strings, numbers, and booleans to
  // be provided as values.
  statementParams: Array<unknown> | null,
  options?: {
    /** Whether the query should explicitly return records. Defaults to `true`. */
    returning?: boolean;
    /**
     * If the query is contained within another query, this option should be set to the
     * model of the parent query. Like that, it becomes possible to reference fields of
     * the parent model in the nested query (the current query).
     */
    parentModel?: Model;
    /** Alias column names that are duplicated when joining multiple tables. */
    expandColumns?: boolean;
  },
): {
  dependencies: Array<Statement>;
  main: Statement;
  loadedFields: Array<ModelField>;
} => {
  // A list of write statements that are required to be executed before the main read
  // statement. Their output is not relevant for the main statement, as they are merely
  // used to update the database in a way that is required for the main read statement
  // to return the expected results.
  const dependencyStatements: Array<Statement> = [];

  // If the query is a meta query of type `create`, `alter`, or `drop`, we need to
  // transform it into a regular query before it can be processed further.
  const query = transformMetaQuery(
    models,
    dependencyStatements,
    statementParams,
    defaultQuery,
  );

  // If no further query processing should happen, we need to return early.
  if (query === null)
    return { dependencies: [], main: dependencyStatements[0], loadedFields: [] };

  // Split out the individual components of the query.
  const parsedQuery = splitQuery(query);
  const { queryType, queryModel, queryInstructions } = parsedQuery;

  // Find the model that the query is interacting with.
  const model = getModelBySlug(models, queryModel);

  // Whether the query will interact with a single record, or multiple at the same time.
  const single = queryModel !== model.pluralSlug;

  // Walk deeper into the query, to the level on which the actual instructions (such as
  // `with` and `including`) are located.
  let instructions = formatIdentifiers(model, queryInstructions);

  const returning = options?.returning ?? true;

  // Apply any presets that are potentially being selected by the query.
  if (instructions && Object.hasOwn(instructions, 'for')) {
    instructions = handleFor(model, instructions);
  }

  // A list of columns that should be selected when querying records.
  const { columns, isJoining, loadedFields } = handleSelecting(
    models,
    model,
    statementParams,
    {
      selecting: instructions?.selecting,
      including: instructions?.including,
    },
    options,
  );

  let statement = '';

  switch (queryType) {
    case 'get':
      statement += `SELECT ${columns} FROM `;
      break;

    case 'set':
      statement += 'UPDATE ';
      break;

    case 'add':
      statement += 'INSERT INTO ';
      break;

    case 'remove':
      statement += 'DELETE FROM ';
      break;

    case 'count':
      statement += `SELECT COUNT(${columns}) FROM `;
      break;
  }

  let isJoiningMultipleRows = false;

  if (isJoining) {
    const { statement: including, tableSubQuery } = handleIncluding(
      models,
      model,
      statementParams,
      instructions?.including,
    );

    // If multiple rows are being joined from a different table, even though the root
    // query is only supposed to return a single row, we need to ensure a limit for the
    // root query *before* joining the other rows. Otherwise, if the limit sits at the
    // end of the full query, only one row would be available at the end.
    if (tableSubQuery) {
      statement += `(${tableSubQuery}) as ${model.tableAlias} `;
      isJoiningMultipleRows = true;
    } else {
      statement += `"${model.table}" `;
    }

    statement += `${including} `;
  } else {
    statement += `"${model.table}" `;
  }

  if (queryType === 'add' || queryType === 'set') {
    // This validation must be performed before any default fields (such as `ronin`) are
    // added to the record. Otherwise there are always fields present.
    if (!isObject(instructions!.to) || Object.keys(instructions!.to).length === 0) {
      throw new RoninError({
        message: `When using a \`${queryType}\` query, the \`to\` instruction must be a non-empty object.`,
        code: 'INVALID_TO_VALUE',
        queries: [query],
      });
    }

    const toStatement = handleTo(
      models,
      model,
      statementParams,
      queryType,
      dependencyStatements,
      { with: instructions!.with, to: instructions!.to },
      options?.parentModel,
    );

    statement += `${toStatement} `;
  }

  const conditions: Array<string> = [];

  // Queries of type "get", "set", "remove", or "count" all support filtering records,
  // but those of type "add" do not.
  if (queryType !== 'add' && instructions && Object.hasOwn(instructions, 'with')) {
    const withStatement = handleWith(
      models,
      model,
      statementParams,
      instructions!.with,
      options?.parentModel,
    );

    if (withStatement.length > 0) conditions.push(withStatement);
  }

  // If a `limitedTo` instruction was provided, that means the amount of records returned
  // by the query will be limited to a specific amount, which, in turn, means that
  // pagination is activated automatically, so a cursor will be provided to the client
  // that can be used to retrieve the next page of records.
  //
  // Since `limitedTo` automatically activates pagination, we have to make sure that, if
  // the instruction is provided, we also automatically provide an `orderedBy`
  // instruction, as pagination requires the records to be ordered by at least one
  // specific column, otherwise the cursor wouldn't work, since the order of the rows
  // might differ between pages.
  if (
    (queryType === 'get' || queryType === 'count') &&
    !single &&
    instructions?.limitedTo
  ) {
    instructions = instructions || {};
    instructions.orderedBy = instructions.orderedBy || {};
    instructions.orderedBy.ascending = instructions.orderedBy.ascending || [];
    instructions.orderedBy.descending = instructions.orderedBy.descending || [];

    if (
      ![
        ...instructions.orderedBy.ascending,
        ...instructions.orderedBy.descending,
      ].includes('ronin.createdAt')
    ) {
      // It's extremely important that the item is added to the end of the array,
      // otherwise https://linear.app/ronin/issue/RON-1084 would occur.
      instructions.orderedBy.descending.push('ronin.createdAt');
    }
  }

  if (
    instructions &&
    (Object.hasOwn(instructions, 'before') || Object.hasOwn(instructions, 'after'))
  ) {
    if (single) {
      throw new RoninError({
        message:
          'The `before` and `after` instructions are not supported when querying for a single record.',
        code: 'INVALID_BEFORE_OR_AFTER_INSTRUCTION',
        queries: [query],
      });
    }

    const beforeAndAfterStatement = handleBeforeOrAfter(model, statementParams, {
      before: instructions.before,
      after: instructions.after,
      with: instructions.with,
      orderedBy: instructions.orderedBy,
      limitedTo: instructions.limitedTo,
    });

    conditions.push(beforeAndAfterStatement);
  }

  if (conditions.length > 0) {
    // If multiple conditions are available, wrap them in parentheses to ensure that the
    // AND/OR comparisons are asserted correctly.
    if (conditions.length === 1) {
      statement += `WHERE ${conditions[0]} `;
    } else {
      statement += `WHERE (${conditions.join(' ')}) `;
    }
  }

  if (instructions?.orderedBy) {
    const orderedByStatement = handleOrderedBy(model, instructions.orderedBy);
    statement += `${orderedByStatement} `;
  }

  if (
    queryType === 'get' &&
    !isJoiningMultipleRows &&
    (single || instructions?.limitedTo)
  ) {
    statement += handleLimitedTo(single, instructions?.limitedTo);
  }

  // For queries that modify records, we want to make sure that the modified record is
  // returned after the modification has been performed.
  if (['add', 'set', 'remove'].includes(queryType) && returning) {
    statement += 'RETURNING * ';
  }

  const mainStatement: Statement = {
    statement: statement.trimEnd(),
    params: statementParams || [],
  };

  // We are setting this property separately to make sure it doesn't even exist if the
  // query doesn't return any output. This makes it easier for developers to visually
  // distinguish queries that return output from those that don't, when looking at the
  // output produced by the compiler.
  if (returning) mainStatement.returning = true;

  return {
    dependencies: dependencyStatements,
    main: mainStatement,
    loadedFields,
  };
};
