import type {
  GetInstructions,
  Instructions,
  Query,
  QueryInstructionType,
  SetInstructions,
  WithInstruction,
} from '@/src/types/query';
import { RONIN_SCHEMA_SYMBOLS, RoninError, isObject } from '@/src/utils';

import { compileQueryInput } from '@/src/index';
import {
  WITH_CONDITIONS,
  type WithCondition,
  type WithFilters,
  type WithValue,
  type WithValueOptions,
} from '@/src/instructions/with';
import type { Schema } from '@/src/types/schema';
import { getSchemaBySlug } from '@/src/utils/schema';
import { getFieldFromSchema } from '@/src/utils/schema';

/**
 * Inserts a value into the list of statement values and returns a placeholder for it.
 *
 * @param statementValues - A list of values to be inserted into the final statements.
 * @param value - The value that should be prepared for insertion.
 * @param bindNull Whether `null` should be inserted into the statement as-is, or whether
 * it should be bound as a statement value. Defaults to `false`.
 *
 * @returns A placeholder for the inserted value.
 */
export const prepareStatementValue = (
  statementValues: Array<unknown>,
  value: unknown,
  bindNull = false,
): string => {
  // In the case of an assertion (such as `field IS NULL`), we can't bind `null` as a
  // statement value. Instead, we have to integrate it into the statement string directly.
  // Only in the case that `null` is used as a value when inserting or updating records,
  // we can skip this condition, so that it will be bound as a statement value.
  if (!bindNull && value === null) return 'NULL';

  let formattedValue = value;

  if (Array.isArray(value) || isObject(value)) {
    formattedValue = JSON.stringify(value);
  } else if (typeof value === 'boolean') {
    // When binding statement values, SQLite requires booleans as integers.
    formattedValue = value ? 1 : 0;
  }

  const index = statementValues.push(formattedValue);
  return `?${index}`;
};

/**
 * Generates an SQL condition, column name, or column value for the provided field.
 *
 * @param schemas - A list of schemas.
 * @param schema - The specific schema being addressed in the query.
 * @param statementValues - A list of values to be inserted into the final statements.
 * @param instructionName - The name of the instruction that is being processed.
 * @param value - The value that the selected field should be compared with.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL condition for the provided field. Alternatively only its column name
 * or column value.
 */
const composeFieldValues = (
  schemas: Array<Schema>,
  schema: Schema,
  statementValues: Array<unknown>,
  instructionName: QueryInstructionType,
  value: WithValue | Record<typeof RONIN_SCHEMA_SYMBOLS.QUERY, Query>,
  options: {
    rootTable?: string;
    fieldSlug: string;
    type?: 'fields' | 'values';
    customTable?: string;
    condition?: WithCondition;
  },
): string => {
  const { field: schemaField, fieldSelector: selector } = getFieldFromSchema(
    schema,
    options.fieldSlug,
    instructionName,
    options.rootTable,
  );

  const isSubQuery =
    isObject(value) && Object.hasOwn(value as object, RONIN_SCHEMA_SYMBOLS.QUERY);

  // If only the field selectors are being requested, do not register any values.
  const collectStatementValue = options.type !== 'fields';

  let conditionSelector = selector;
  let conditionValue = value;

  if (isSubQuery && collectStatementValue) {
    conditionValue = `(${
      compileQueryInput(
        (value as Record<string, Query>)[RONIN_SCHEMA_SYMBOLS.QUERY],
        schemas,
        { statementValues },
      ).readStatement
    })`;
  } else if (typeof value === 'string' && value.startsWith(RONIN_SCHEMA_SYMBOLS.FIELD)) {
    let targetTable = `"${options.rootTable}"`;
    let toReplace: string = RONIN_SCHEMA_SYMBOLS.FIELD;

    if (value.startsWith(RONIN_SCHEMA_SYMBOLS.FIELD_OLD)) {
      targetTable = 'OLD';
      toReplace = RONIN_SCHEMA_SYMBOLS.FIELD_OLD;
    } else if (value.startsWith(RONIN_SCHEMA_SYMBOLS.FIELD_NEW)) {
      targetTable = 'NEW';
      toReplace = RONIN_SCHEMA_SYMBOLS.FIELD_NEW;
    }

    conditionSelector = `${options.customTable ? `"${options.customTable}".` : ''}"${schemaField.slug}"`;
    conditionValue = `${targetTable}."${value.replace(toReplace, '')}"`;
  }
  // For columns containing JSON, special handling is required, because the properties
  // inside a JSON structure cannot be updated directly using column selectors, and must
  // instead be patched through a JSON function, since the properties are all stored
  // inside a single TEXT column.
  else if (schemaField.type === 'json' && instructionName === 'to') {
    conditionSelector = `"${schemaField.slug}"`;

    if (collectStatementValue) {
      const preparedValue = prepareStatementValue(statementValues, value, false);
      conditionValue = `IIF(${conditionSelector} IS NULL, ${preparedValue}, json_patch(${conditionSelector}, ${preparedValue}))`;
    }
  } else if (collectStatementValue) {
    conditionValue = prepareStatementValue(statementValues, value, false);
  }

  if (options.type === 'fields') return conditionSelector;
  if (options.type === 'values') return conditionValue as string;

  return `${conditionSelector} ${WITH_CONDITIONS[options.condition || 'being'](conditionValue, value)}`;
};

/**
 * Generates the conditions for each of the fields asserted in a given query instruction.
 *
 * @param schemas - A list of schemas.
 * @param schema - The specific schema being addressed in the query.
 * @param statementValues - A list of values to be inserted into the final statements.
 * @param instructionName - The name of the instruction that is being processed.
 * @param value - The value that the selected field should be compared with.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns A list of SQL conditions for the provided query instructions.
 */
export const composeConditions = (
  schemas: Array<Schema>,
  schema: Schema,
  statementValues: Array<unknown>,
  instructionName: QueryInstructionType,
  value:
    | WithFilters
    | WithValueOptions
    | Record<typeof RONIN_SCHEMA_SYMBOLS.QUERY, Query>,
  options: Omit<Parameters<typeof composeFieldValues>[5], 'fieldSlug'> & {
    fieldSlug?: string;
  },
): string => {
  const isNested = isObject(value) && Object.keys(value as object).length > 0;

  // 1. Check for conditions.
  //
  // Most commonly, the surrounding function is provided with an object. Before we can
  // continue processing any potential fields inside of this object, we would like to
  // assert whether it contains any of the known query conditions (such as `being`). If
  // it does, we want to invoke the surrounding function again, but additionally provide
  // information about which kind of condition is being performed.
  if (isNested && Object.keys(value as object).every((key) => key in WITH_CONDITIONS)) {
    const conditions = (
      Object.entries(value as object) as Array<[WithCondition, WithValueOptions]>
    ).map(([conditionType, checkValue]) =>
      composeConditions(schemas, schema, statementValues, instructionName, checkValue, {
        ...options,
        condition: conditionType,
      }),
    );

    return conditions.join(' AND ');
  }

  // 2. Check for the existance of a field.
  //
  // If the surrounding function was provided with a `fieldSlug`, that means the value of
  // a field is being asserted, so we first have to check whether that field exists and
  // then check its type. Based on that, we then know how to treat the value of the field.
  //
  // Specifically, if the field is of the type "reference" or "json", we have to treat any
  // potential object value in a special way, instead of just iterating over the nested
  // fields and trying to assert the column for each one.
  if (options.fieldSlug) {
    const fieldDetails = getFieldFromSchema(
      schema,
      options.fieldSlug,
      instructionName,
      options.rootTable,
    );

    const { field: schemaField } = fieldDetails;

    // If the `to` instruction is used, JSON should be written as-is.
    const consumeJSON = schemaField.type === 'json' && instructionName === 'to';

    const isSubQuery =
      isNested && Object.hasOwn(value as object, RONIN_SCHEMA_SYMBOLS.QUERY);

    if (!(isObject(value) || Array.isArray(value)) || isSubQuery || consumeJSON) {
      return composeFieldValues(
        schemas,
        schema,
        statementValues,
        instructionName,
        value as WithValue,
        { ...options, fieldSlug: options.fieldSlug as string },
      );
    }

    if (schemaField.type === 'reference' && isNested) {
      // `value` is asserted to be an object using `isObject` above, so we can safely
      // cast it here. The type is not being inferred automatically.
      const keys = Object.keys(value as object);
      const values = Object.values(value as object);

      let recordTarget: WithValue | Record<typeof RONIN_SCHEMA_SYMBOLS.QUERY, Query>;

      // If only a single key is present, and it's "id", then we can simplify the query a
      // bit in favor of performance, because the stored value of a reference field in
      // SQLite is always the ID of the related record. That means we don't need to join
      // the destination table, and we can just perform a string assertion.
      if (keys.length === 1 && keys[0] === 'id') {
        // This can be either a string or an object with conditions such as `being`.
        recordTarget = values[0];
      } else {
        const relatedSchema = getSchemaBySlug(schemas, schemaField.target.slug);

        const subQuery: Query = {
          get: {
            [relatedSchema.slug]: {
              with: value as WithInstruction,
              selecting: ['id'],
            },
          },
        };

        recordTarget = {
          [RONIN_SCHEMA_SYMBOLS.QUERY]: subQuery,
        };
      }

      return composeConditions(
        schemas,
        schema,
        statementValues,
        instructionName,
        recordTarget,
        options,
      );
    }
  }

  // 3. Check for the existance of nested fields.
  //
  // If the value of the field is an object at this stage of the function, that means
  // we are dealing with an object full of nested fields, because other kinds of objects
  // (e.g. JSON objects, Reference objects, and objects containing conditions) have
  // already been matched further above.
  //
  // We can therefore iterate over all fields inside that object and invoke the
  // surrounding function again for each one, in order to handle any deeply nested fields
  // or conditions that might be available.
  if (isNested) {
    const conditions = Object.entries(value as object).map(([field, value]) => {
      const nestedFieldSlug = options.fieldSlug ? `${options.fieldSlug}.${field}` : field;

      // If the value of the field is an object or array, we have to assume it might
      // either contain a list of nested fields that must be matched, or a list of
      // conditions (such as `being`, `notBeing`) that must be matched, so we have to
      // start from the beginning again.
      return composeConditions(schemas, schema, statementValues, instructionName, value, {
        ...options,
        fieldSlug: nestedFieldSlug,
      });
    });

    const joiner = instructionName === 'to' ? ', ' : ' AND ';

    if (instructionName === 'to') return `${conditions.join(joiner)}`;
    return conditions.length === 1
      ? conditions[0]
      : options.fieldSlug
        ? `(${conditions.join(joiner)})`
        : conditions.join(joiner);
  }

  // 4. Check for OR conditions.
  //
  // If the provided value is an array and none of the checks further above have been
  // matched, that means we're dealing with an OR condition, so each of the values inside
  // the array must be treated as a possibility inside of an OR condition.
  if (Array.isArray(value)) {
    const conditions = value.map((filter) =>
      composeConditions(
        schemas,
        schema,
        statementValues,
        instructionName,
        filter,
        options,
      ),
    );

    return conditions.join(' OR ');
  }

  // 5. Handle empty fields.
  //
  // If the provided value could not be matched against any of the allowed value types,
  // that means the provided value is empty, which is not allowed. To inform the
  // developer, we are therefore throwing an error.
  throw new RoninError({
    message: `The \`with\` instruction must not contain an empty field. The following fields are empty: \`${options.fieldSlug}\`. If you meant to query by an empty field, try using \`null\` instead.`,
    code: 'INVALID_WITH_VALUE',
    queries: null,
  });
};

/**
 * Finds special identifiers (Name Identifier or Slug Identifier) in the instructions of
 * a query and replaces them with their respective field slugs.
 *
 * For example, if the field `firstName` is configured as the Title Identifier in the
 * schema, any use of `nameIdentifier` will be replaced with `firstName` inside the
 * query instructions.
 *
 * @param schema - The schema being addressed in the query.
 * @param queryInstructions - The instructions of the query that is being run.
 *
 * @returns The provided query instructions, with special identifiers replaced.
 */
export const formatIdentifiers = (
  { identifiers }: Schema,
  queryInstructions: Instructions,
): Instructions & SetInstructions => {
  // Queries might not have instructions (such as `get.accounts`).
  if (!queryInstructions) return queryInstructions;

  const type = 'with' in queryInstructions ? 'with' : null;

  // Special identifiers may only be used in the `with` instructions, so we
  // want to skip all others.
  if (!type) return queryInstructions as Instructions & SetInstructions;

  // We currently also don't need to support special identifiers inside arrays.
  const nestedInstructions = (queryInstructions as GetInstructions)[type];
  if (!nestedInstructions || Array.isArray(nestedInstructions))
    return queryInstructions as Instructions & SetInstructions;

  const newNestedInstructions = { ...nestedInstructions };

  for (const oldKey of Object.keys(newNestedInstructions)) {
    if (oldKey !== 'nameIdentifier' && oldKey !== 'slugIdentifier') continue;

    const identifierName = oldKey === 'nameIdentifier' ? 'name' : 'slug';
    const value = newNestedInstructions[oldKey];
    const newKey = identifiers?.[identifierName] || 'id';

    newNestedInstructions[newKey] = value;
    delete newNestedInstructions[oldKey];
  }

  return {
    ...queryInstructions,
    [type]: newNestedInstructions,
  } as Instructions & SetInstructions;
};
