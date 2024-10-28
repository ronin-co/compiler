import { compileQueryInput } from '@/src/index';
import type { WithFilters } from '@/src/instructions/with';
import type { Instructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { RoninError, splitQuery } from '@/src/utils';
import { getSchemaBySlug, getSchemaName, getTableForSchema } from '@/src/utils/schema';
import { composeConditions } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `including` query instruction, which allows for
 * joining records from other schemas.
 *
 * @param schemas - A list of schemas.
 * @param statementValues - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param schema - The schema being addressed in the query.
 * @param instruction - The `including` instruction provided in the current query.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The SQL syntax for the provided `including` instruction.
 */
export const handleIncluding = (
  schemas: Array<Schema>,
  statementValues: Array<unknown>,
  schema: Schema,
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

  for (const shortcut of instruction || []) {
    const includingQuery = schema.including?.[shortcut];

    if (!includingQuery) {
      throw new RoninError({
        message: `The provided \`including\` shortcut "${shortcut}" does not exist in schema "${getSchemaName(schema)}".`,
        code: 'INVALID_INCLUDING_VALUE',
      });
    }

    const { queryType, querySchema, queryInstructions } = splitQuery(includingQuery);
    let modifiableQueryInstructions = queryInstructions;

    const relatedSchema = getSchemaBySlug(schemas, querySchema);

    let joinType: 'LEFT' | 'CROSS' = 'LEFT';
    let relatedTableSelector = `"${getTableForSchema(relatedSchema)}"`;

    const tableAlias = `including_${shortcut}`;
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
        { statementValues },
      );

      relatedTableSelector = `(${subSelect.readStatement})`;
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
        statementValues,
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
