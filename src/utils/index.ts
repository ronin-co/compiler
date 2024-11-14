import { handleBeforeOrAfter } from '@/src/instructions/before-after';
import { handleFor } from '@/src/instructions/for';
import { handleIncluding } from '@/src/instructions/including';
import { handleLimitedTo } from '@/src/instructions/limited-to';
import { handleOrderedBy } from '@/src/instructions/ordered-by';
import { handleSelecting } from '@/src/instructions/selecting';
import { handleTo } from '@/src/instructions/to';
import { handleWith } from '@/src/instructions/with';
import type { Model } from '@/src/types/model';
import type { Query, Statement } from '@/src/types/query';
import { RoninError, isObject, splitQuery } from '@/src/utils/helpers';
import { addModelQueries, getModelBySlug } from '@/src/utils/model';
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
  query: Query,
  models: Array<Model>,
  // In order to prevent SQL injections and allow for faster query execution, we're not
  // inserting any values into the SQL statement directly. Instead, we will pass them to
  // SQLite's API later on, so that it can prepare an object that the database can
  // execute in a safe and fast manner. SQLite allows strings, numbers, and booleans to
  // be provided as values.
  statementParams: Array<unknown> | null,
  options?: {
    /**
     * Whether the query should explicitly return records. Defaults to `true`.
     */
    returning?: boolean;
    /**
     * If the query is contained within another query, this property should be set to the
     * name of the table of the parent query. Like that, it becomes possible to reference
     * fields of the parent model in the nested query (the current query).
     */
    parentTable?: string;
  },
): { dependencies: Array<Statement>; main: Statement } => {
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

  // The name of the table in SQLite that contains the records that are being addressed.
  // This always matches the plural slug of the model, but in snake case.
  let { table } = model;

  // A list of write statements that are required to be executed before the main read
  // statement. Their output is not relevant for the main statement, as they are merely
  // used to update the database in a way that is required for the main read statement
  // to return the expected results.
  const dependencyStatements: Array<Statement> = [];

  const returning = options?.returning ?? true;

  // Generate additional dependency statements for meta queries, meaning queries that
  // affect the database model.
  instructions = addModelQueries(
    models,
    { queryType, queryModel, queryInstructions: instructions },
    dependencyStatements,
  );

  // Apply any presets that are potentially being selected by the query.
  if (instructions && Object.hasOwn(instructions, 'for')) {
    instructions = handleFor(model, instructions);
  }

  // A list of columns that should be selected when querying records.
  const { columns, isJoining } = handleSelecting(model, statementParams, {
    selecting: instructions?.selecting,
    including: instructions?.including,
  });

  let statement = '';

  switch (queryType) {
    case 'get':
      statement += `SELECT ${columns} FROM `;
      break;

    case 'count':
      statement += `SELECT COUNT(${columns}) FROM `;
      break;

    case 'drop':
      statement += 'DELETE FROM ';
      break;

    case 'create':
      statement += 'INSERT INTO ';
      break;

    case 'set':
      statement += 'UPDATE ';
      break;
  }

  let isJoiningMultipleRows = false;

  if (isJoining) {
    const {
      statement: including,
      rootTableSubQuery,
      rootTableName,
    } = handleIncluding(models, statementParams, instructions?.including, table);

    // If multiple rows are being joined from a different table, even though the root
    // query is only supposed to return a single row, we need to ensure a limit for the
    // root query *before* joining the other rows. Otherwise, if the limit sits at the
    // end of the full query, only one row would be available at the end.
    if (rootTableSubQuery && rootTableName) {
      table = rootTableName;
      statement += `(${rootTableSubQuery}) as ${rootTableName} `;
      isJoiningMultipleRows = true;
    } else {
      statement += `"${table}" `;
    }

    statement += `${including} `;

    // Show the table name for every column. By default, it doesn't show, but since we
    // are joining multiple tables together, we need to show the table name for every
    // table, in order to avoid conflicts.
    model.tableAlias = table;
  } else {
    statement += `"${table}" `;
  }

  if (queryType === 'create' || queryType === 'set') {
    // This validation must be performed before any default fields (such as `ronin`) are
    // added to the record. Otherwise there are always fields present.
    if (!isObject(instructions.to) || Object.keys(instructions.to).length === 0) {
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
      { with: instructions.with, to: instructions.to },
      {
        parentTable: options?.parentTable,
      },
    );

    statement += `${toStatement} `;
  }

  const conditions: Array<string> = [];

  // Queries of type "get", "set", "drop", or "count" all support filtering records, but
  // those of type "create" do not.
  if (queryType !== 'create' && instructions && Object.hasOwn(instructions, 'with')) {
    const withStatement = handleWith(models, model, statementParams, instructions?.with, {
      parentTable: options?.parentTable,
    });

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
  if (['create', 'set', 'drop'].includes(queryType) && returning) {
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
  };
};
