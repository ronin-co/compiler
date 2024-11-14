import type {
  GetInstructions,
  Instructions,
  Query,
  QueryInstructionType,
  SetInstructions,
  WithInstruction,
} from '@/src/types/query';
import {
  RONIN_MODEL_FIELD_REGEX,
  RONIN_MODEL_SYMBOLS,
  RoninError,
  isObject,
} from '@/src/utils/helpers';

import {
  WITH_CONDITIONS,
  type WithCondition,
  type WithFilters,
  type WithValue,
  type WithValueOptions,
} from '@/src/instructions/with';
import type { Model } from '@/src/types/model';
import { compileQueryInput } from '@/src/utils/index';
import { getFieldFromModel, getModelBySlug } from '@/src/utils/model';

/**
 * Inserts a value into the list of statement values and returns a placeholder for it.
 *
 * @param statementParams - A list of values to be inserted into the final statements.
 * @param value - The value that should be prepared for insertion.
 *
 * @returns A placeholder for the inserted value.
 */
export const prepareStatementValue = (
  statementParams: Array<unknown> | null,
  value: unknown,
): string => {
  // We don't need to register `null` as a statement value, because it's not a value, but
  // rather a representation of the absence of a value. We can just inline it.
  if (value === null) return 'NULL';

  // If no list of statement values is available, that means we should inline the value,
  // which is desired in cases where there is no risk of SQL injection and where the
  // values must be plainly visible for manual human inspection.
  if (!statementParams) return JSON.stringify(value);

  let formattedValue = value;

  if (Array.isArray(value) || isObject(value)) {
    formattedValue = JSON.stringify(value);
  } else if (typeof value === 'boolean') {
    // When binding statement values, SQLite requires booleans as integers.
    formattedValue = value ? 1 : 0;
  }

  const index = statementParams.push(formattedValue);
  return `?${index}`;
};

/**
 * Generates an SQL condition, column name, or column value for the provided field.
 *
 * @param models - A list of models.
 * @param model - The specific model being addressed in the query.
 * @param statementParams - A list of values to be inserted into the final statements.
 * @param instructionName - The name of the instruction that is being processed.
 * @param value - The value that the selected field should be compared with.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL condition for the provided field. Alternatively only its column name
 * or column value.
 */
const composeFieldValues = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  instructionName: QueryInstructionType,
  value: WithValue | Record<typeof RONIN_MODEL_SYMBOLS.QUERY, Query>,
  options: {
    fieldSlug: string;
    type?: 'fields' | 'values';
    parentTable?: string;
    condition?: WithCondition;
  },
): string => {
  const { fieldSelector: conditionSelector } = getFieldFromModel(
    model,
    options.fieldSlug,
    instructionName,
  );

  // If only the field selectors are being requested, do not register any values.
  const collectStatementValue = options.type !== 'fields';

  // Determine if the value of the field is a symbol.
  const symbol = getSymbol(value);

  let conditionValue = value;

  if (symbol) {
    // The value of the field is a RONIN expression, which we need to compile into an SQL
    // syntax that can be run.
    if (symbol?.type === 'expression') {
      conditionValue = symbol.value.replace(RONIN_MODEL_FIELD_REGEX, (match) => {
        let toReplace: string = RONIN_MODEL_SYMBOLS.FIELD;
        let rootModel: Model = model;

        if (match.startsWith(RONIN_MODEL_SYMBOLS.FIELD_PARENT)) {
          if (options.parentTable) {
            const cleanModelSlug = options.parentTable.replace('sub_', '');
            rootModel = getModelBySlug(models, cleanModelSlug);
          }

          rootModel.tableAlias = options.parentTable;
          toReplace = RONIN_MODEL_SYMBOLS.FIELD_PARENT;

          if (match.startsWith(RONIN_MODEL_SYMBOLS.FIELD_PARENT_OLD)) {
            rootModel.tableAlias = toReplace = RONIN_MODEL_SYMBOLS.FIELD_PARENT_OLD;
          } else if (match.startsWith(RONIN_MODEL_SYMBOLS.FIELD_PARENT_NEW)) {
            rootModel.tableAlias = toReplace = RONIN_MODEL_SYMBOLS.FIELD_PARENT_NEW;
          }
        }

        const fieldSlug = match.replace(toReplace, '');
        const field = getFieldFromModel(rootModel, fieldSlug, instructionName);

        return field.fieldSelector;
      });
    }

    // The value of the field is a RONIN query, which we need to compile into an SQL
    // syntax that can be run.
    if (symbol.type === 'query' && collectStatementValue) {
      conditionValue = `(${
        compileQueryInput(symbol.value, models, statementParams).main.statement
      })`;
    }
  } else if (collectStatementValue) {
    conditionValue = prepareStatementValue(statementParams, value);
  }

  if (options.type === 'fields') return conditionSelector;
  if (options.type === 'values') return conditionValue as string;

  return `${conditionSelector} ${WITH_CONDITIONS[options.condition || 'being'](conditionValue, value)}`;
};

/**
 * Generates the conditions for each of the fields asserted in a given query instruction.
 *
 * @param models - A list of models.
 * @param model - The specific model being addressed in the query.
 * @param statementParams - A list of values to be inserted into the final statements.
 * @param instructionName - The name of the instruction that is being processed.
 * @param value - The value that the selected field should be compared with.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns An SQL string representing the conditions for the provided query instructions.
 */
export const composeConditions = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  instructionName: QueryInstructionType,
  value: WithFilters | WithValueOptions | Record<typeof RONIN_MODEL_SYMBOLS.QUERY, Query>,
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
      composeConditions(models, model, statementParams, instructionName, checkValue, {
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
    const fieldDetails = getFieldFromModel(model, options.fieldSlug, instructionName);

    const { field: modelField } = fieldDetails;

    // If the `to` instruction is used, JSON should be written as-is.
    const consumeJSON = modelField.type === 'json' && instructionName === 'to';

    if (!(isObject(value) || Array.isArray(value)) || getSymbol(value) || consumeJSON) {
      return composeFieldValues(
        models,
        model,
        statementParams,
        instructionName,
        value as WithValue,
        { ...options, fieldSlug: options.fieldSlug as string },
      );
    }

    if (modelField.type === 'reference' && isNested) {
      // `value` is asserted to be an object using `isObject` above, so we can safely
      // cast it here. The type is not being inferred automatically.
      const keys = Object.keys(value as object);
      const values = Object.values(value as object);

      let recordTarget: WithValue | Record<typeof RONIN_MODEL_SYMBOLS.QUERY, Query>;

      // If only a single key is present, and it's "id", then we can simplify the query a
      // bit in favor of performance, because the stored value of a reference field in
      // SQLite is always the ID of the related record. That means we don't need to join
      // the destination table, and we can just perform a string assertion.
      if (keys.length === 1 && keys[0] === 'id') {
        // This can be either a string or an object with conditions such as `being`.
        recordTarget = values[0];
      } else {
        const relatedModel = getModelBySlug(models, modelField.target.slug);

        const subQuery: Query = {
          get: {
            [relatedModel.slug]: {
              with: value as WithInstruction,
              selecting: ['id'],
            },
          },
        };

        recordTarget = {
          [RONIN_MODEL_SYMBOLS.QUERY]: subQuery,
        };
      }

      return composeConditions(
        models,
        model,
        statementParams,
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
      return composeConditions(models, model, statementParams, instructionName, value, {
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
      composeConditions(models, model, statementParams, instructionName, filter, options),
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
 * model, any use of `nameIdentifier` will be replaced with `firstName` inside the
 * query instructions.
 *
 * @param model - The model being addressed in the query.
 * @param queryInstructions - The instructions of the query that is being run.
 *
 * @returns The provided query instructions, with special identifiers replaced.
 */
export const formatIdentifiers = (
  { identifiers }: Model,
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
    const newKey = identifiers[identifierName];

    newNestedInstructions[newKey] = value;
    delete newNestedInstructions[oldKey];
  }

  return {
    ...queryInstructions,
    [type]: newNestedInstructions,
  } as Instructions & SetInstructions;
};

/**
 * Checks if the provided value contains a symbol and returns its type and value.
 *
 * @param value - The value that should be checked.
 *
 * @returns The type and value of the symbol, if the provided value contains one.
 */
export const getSymbol = (
  value: unknown,
):
  | {
      type: 'query';
      value: Query;
    }
  | {
      type: 'expression';
      value: string;
    }
  | null => {
  if (!isObject(value)) return null;
  const objectValue = value as
    | Record<typeof RONIN_MODEL_SYMBOLS.QUERY, Query>
    | Record<typeof RONIN_MODEL_SYMBOLS.EXPRESSION, string>;

  if (RONIN_MODEL_SYMBOLS.QUERY in objectValue) {
    return {
      type: 'query',
      value: objectValue[RONIN_MODEL_SYMBOLS.QUERY],
    };
  }

  if (RONIN_MODEL_SYMBOLS.EXPRESSION in objectValue) {
    return {
      type: 'expression',
      value: objectValue[RONIN_MODEL_SYMBOLS.EXPRESSION],
    };
  }

  return null;
};
