import type { Model } from '@/src/types/model';
import type { GetInstructions } from '@/src/types/query';
import { getFieldFromModel } from '@/src/utils/model';

/**
 * Generates the SQL syntax for the `orderedBy` query instruction, which allows for
 * ordering the list of records that are returned.
 *
 * @param model - The model being addressed in the query.
 * @param instruction - The `orderedBy` instruction provided in the current query.
 *
 * @returns The SQL syntax for the provided `orderedBy` instruction.
 */
export const handleOrderedBy = (
  model: Model,
  instruction: GetInstructions['orderedBy'],
): string => {
  let statement = '';

  for (const field of instruction!.ascending || []) {
    // Check whether the field exists.
    const { field: modelField, fieldSelector } = getFieldFromModel(
      model,
      field,
      'orderedBy.ascending',
    );

    if (statement.length > 0) {
      statement += ', ';
    }

    const caseInsensitiveStatement =
      modelField.type === 'string' ? ' COLLATE NOCASE' : '';

    statement += `${fieldSelector}${caseInsensitiveStatement} ASC`;
  }

  // If multiple records are being retrieved, the `orderedBy.descending` property is
  // never undefined, because it is automatically added outside the `handleOrderedBy`
  // function. If a single record is being retrieved, however, it will be undefined, so
  // we need the empty array fallback.
  for (const field of instruction!.descending || []) {
    // Check whether the field exists.
    const { field: modelField, fieldSelector } = getFieldFromModel(
      model,
      field,
      'orderedBy.descending',
    );

    if (statement.length > 0) {
      statement += ', ';
    }

    const caseInsensitiveStatement =
      modelField.type === 'string' ? ' COLLATE NOCASE' : '';

    statement += `${fieldSelector}${caseInsensitiveStatement} DESC`;
  }

  return `ORDER BY ${statement}`;
};
