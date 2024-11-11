import type { WithFilters } from '@/src/instructions/with';
import type { Instructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { splitQuery } from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';
import { getSchemaBySlug, getTableForSchema } from '@/src/utils/schema';
import { composeConditions, getSubQuery } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `including` query instruction, which allows for
 * joining records from other schemas.
 *
 * @param schemas - A list of schemas.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param instruction - The `including` instruction provided in the current query.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The SQL syntax for the provided `including` instruction.
 */
export const handleIncluding = (
  schemas: Array<Schema>,
  statementParams: Array<unknown> | null,
  instruction: Instructions['including'],
  rootTable?: string,
): {
  statement: string;
  rootTableSubQuery?: string;
  rootTableName?: string;
} => {
  let statement = '';

  let rootTableSubQuery: string | undefined;
  let rootTableName = rootTable;

  for (const ephemeralFieldSlug in instruction) {
    const includingQuery = getSubQuery(instruction[ephemeralFieldSlug]);

    // The `including` instruction might contain values that are not queries, which are
    // taken care of by the `handleSelecting` function. Specifically, those values are
    // static values that must be added to the resulting SQL statement as custom columns.
    //
    // Only in the case that the `including` instruction contains a query, we want to
    // continue with this function and process the query as an SQL JOIN.
    if (!includingQuery) continue;

    const { queryType, querySchema, queryInstructions } = splitQuery(includingQuery);
    let modifiableQueryInstructions = queryInstructions;

    const relatedSchema = getSchemaBySlug(schemas, querySchema);

    let joinType: 'LEFT' | 'CROSS' = 'LEFT';
    let relatedTableSelector = `"${getTableForSchema(relatedSchema)}"`;

    const tableAlias = `including_${ephemeralFieldSlug}`;
    const single = querySchema !== relatedSchema.pluralSlug;

    // If no `with` query instruction is provided, we want to perform a CROSS
    // JOIN instead of a LEFT JOIN, because it is guaranteed that the joined
    // rows are the same for every row in the original table, since they are not
    // being filtered at all.
    if (!modifiableQueryInstructions?.with) {
      joinType = 'CROSS';

      // If the query is limited to a single record, we also need to set the
      // `limitedTo` instruction, so that a sub query is being prepared below.
      // We are purposefully only doing this if no `with` instruction is
      // available, because if a `with` instruction is available, it is highly
      // likely that rows that are being joined differ for every row on the
      // root table, in which case we don't want to use a sub query, since the
      // JOIN itself naturally only selects the rows that are needed.
      if (single) {
        if (!modifiableQueryInstructions) modifiableQueryInstructions = {};
        modifiableQueryInstructions.limitedTo = 1;
      }
    }

    // If instructions are provided that SQLite does not support as part of a
    // JOIN, we need to use a sub query to first prepare the rows before we can
    // perform a JOIN.
    //
    // Sub queries are generally less efficient than joins, since SQLite has to
    // plan them as a separate query, which is less efficient than planning a
    // single query just once. However, in this case, it is necessary.
    if (
      modifiableQueryInstructions?.limitedTo ||
      modifiableQueryInstructions?.orderedBy
    ) {
      const subSelect = compileQueryInput(
        {
          [queryType]: {
            [querySchema]: modifiableQueryInstructions,
          },
        },
        schemas,
        statementParams,
      );

      relatedTableSelector = `(${subSelect.main.statement})`;
    }

    statement += `${joinType} JOIN ${relatedTableSelector} as ${tableAlias}`;

    if (joinType === 'LEFT') {
      if (!single) {
        rootTableSubQuery = `SELECT * FROM "${rootTable}" LIMIT 1`;
        rootTableName = `sub_${rootTable}`;
      }

      const subStatement = composeConditions(
        schemas,
        relatedSchema,
        statementParams,
        'including',
        queryInstructions?.with as WithFilters,
        {
          rootTable: rootTableName,
          customTable: tableAlias,
        },
      );

      statement += ` ON (${subStatement})`;
    }
  }

  return { statement, rootTableSubQuery, rootTableName };
};
