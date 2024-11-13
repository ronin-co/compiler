import type { Schema } from '@/src/types/model';
import type { GetInstructions } from '@/src/types/query';
import { getFieldFromSchema } from '@/src/utils/schema';

/**
 * Generates the SQL syntax for the `orderedBy` query instruction, which allows for
 * ordering the list of records that are returned.
 *
 * @param schema - The schema being addressed in the query.
 * @param instruction - The `orderedBy` instruction provided in the current query.
 * @param rootTable - The table for which the current query is being executed.
 *
 * @returns The SQL syntax for the provided `orderedBy` instruction.
 */
export const handleOrderedBy = (
  schema: Schema,
  instruction: GetInstructions['orderedBy'],
  rootTable?: string,
): string => {
  let statement = '';

  for (const field of instruction!.ascending || []) {
    // Check whether the field exists.
    const { field: schemaField, fieldSelector } = getFieldFromSchema(
      schema,
      field,
      'orderedBy.ascending',
      rootTable,
    );

    if (statement.length > 0) {
      statement += ', ';
    }

    const caseInsensitiveStatement =
      schemaField.type === 'string' ? ' COLLATE NOCASE' : '';

    statement += `${fieldSelector}${caseInsensitiveStatement} ASC`;
  }

  // If multiple records are being retrieved, the `orderedBy.descending` property is
  // never undefined, because it is automatically added outside the `handleOrderedBy`
  // function. If a single record is being retrieved, however, it will be undefined, so
  // we need the empty array fallback.
  for (const field of instruction!.descending || []) {
    // Check whether the field exists.
    const { field: schemaField, fieldSelector } = getFieldFromSchema(
      schema,
      field,
      'orderedBy.descending',
      rootTable,
    );

    if (statement.length > 0) {
      statement += ', ';
    }

    const caseInsensitiveStatement =
      schemaField.type === 'string' ? ' COLLATE NOCASE' : '';

    statement += `${fieldSelector}${caseInsensitiveStatement} DESC`;
  }

  return `ORDER BY ${statement}`;
};
