import type { Model } from '@/src/types/model';
import type { Query, QuerySchemaType, QueryType } from '@/src/types/query';

import { init as cuid } from '@paralleldrive/cuid2';

/** A regex for asserting RONIN record IDs. */
export const RECORD_ID_REGEX = /[a-z]{3}_[a-z0-9]{16}/;

/** A regex for asserting RONIN record timestamps. */
export const RECORD_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

/**
 * A list of placeholders that can be located inside queries after those queries were
 * serialized into JSON objects.
 *
 * These placeholders are used to represent special keys and values. For example, if a
 * query is nested into a query, the nested query will be marked with `__RONIN_QUERY`,
 * which allows for distinguishing that nested query from an object of instructions.
 */
export const RONIN_MODEL_SYMBOLS = {
  // Represents a sub query.
  QUERY: '__RONIN_QUERY',

  // Represents an expression that should be evaluated.
  EXPRESSION: '__RONIN_EXPRESSION',

  // Represents the value of a field in the model.
  FIELD: '__RONIN_FIELD_',

  // Represents the value of a field in the model of a parent query.
  FIELD_PARENT: '__RONIN_FIELD_PARENT_',

  // Represents the old value of a field in the parent model. Used for triggers.
  FIELD_PARENT_OLD: '__RONIN_FIELD_PARENT_OLD_',

  // Represents the new value of a field in the parent model. Used for triggers.
  FIELD_PARENT_NEW: '__RONIN_FIELD_PARENT_NEW_',

  // Represents a value provided to a query preset.
  VALUE: '__RONIN_VALUE',
} as const;

/**
 * A regular expression for matching the symbol that represents a field of a model.
 */
export const RONIN_MODEL_FIELD_REGEX = new RegExp(
  `${RONIN_MODEL_SYMBOLS.FIELD}[_a-zA-Z0-9]+`,
  'g',
);

type RoninErrorCode =
  | 'MODEL_NOT_FOUND'
  | 'FIELD_NOT_FOUND'
  | 'PRESET_NOT_FOUND'
  | 'INVALID_WITH_VALUE'
  | 'INVALID_TO_VALUE'
  | 'INVALID_INCLUDING_VALUE'
  | 'INVALID_FOR_VALUE'
  | 'INVALID_BEFORE_OR_AFTER_INSTRUCTION'
  | 'INVALID_MODEL_VALUE'
  | 'MUTUALLY_EXCLUSIVE_INSTRUCTIONS'
  | 'MISSING_INSTRUCTION'
  | 'MISSING_FIELD';

interface Issue {
  message: string;
  path: Array<string | number>;
}

interface Details {
  message: string;
  code: RoninErrorCode;
  field?: string;
  fields?: Array<string>;
  issues?: Array<Issue>;
  queries?: Array<Query> | null;
}

export class RoninError extends Error {
  code: Details['code'];
  field?: Details['field'];
  fields?: Details['fields'];
  issues?: Details['issues'];
  queries?: Details['queries'];

  constructor(details: Details) {
    super(details.message);

    this.name = 'RoninError';
    this.code = details.code;
    this.field = details.field;
    this.fields = details.fields;
    this.issues = details.issues;
    this.queries = details.queries || null;
  }
}

const SINGLE_QUOTE_REGEX = /'/g;
const DOUBLE_QUOTE_REGEX = /"/g;
const AMPERSAND_REGEX = /\s*&+\s*/g;
const SPECIAL_CHARACTERS_REGEX = /[^\w\s-]+/g;
const SPLIT_REGEX = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[\s.\-_]+/;

/**
 * Generate a unique record ID.
 *
 * @param prefix - The prefix that should be used for the ID. Defaults to `rec`.
 *
 * @returns The generated ID.
 */
export const generateRecordId = (prefix: Model['idPrefix']) =>
  `${prefix}_${cuid({ length: 16 })()}`;

/**
 * Utility function to capitalize the first letter of a string while converting all other
 * letters to lowercase.
 *
 * @param str - The string to capitalize.
 *
 * @returns The capitalized string.
 */
export const capitalize = (str: string): string => {
  if (!str || str.length === 0) return '';

  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Utility function to sanitize a given string.
 *
 * - Removes single quotes.
 * - Removes double quotes.
 * - Replaces `&` with `and`.
 * - Replaces special characters with spaces.
 * - Strips leading and trailing whitespace.
 *
 * @param str – The string to sanitize.
 *
 * @returns The sanitized string.
 */
const sanitize = (str: string) => {
  if (!str || str.length === 0) return '';

  return (
    str
      // Remove single quotes from the string.
      .replace(SINGLE_QUOTE_REGEX, '')
      // Remove double quotes from the string.
      .replace(DOUBLE_QUOTE_REGEX, '')
      // Replace `&` with `and`.
      .replace(AMPERSAND_REGEX, ' and ')
      // Replace special characters with spaces.
      .replace(SPECIAL_CHARACTERS_REGEX, ' ')
      // Strip leading and trailing whitespace.
      .trim()
  );
};

/**
 * Utility function to convert a given string to snake-case.
 *
 * @param str – The string to convert.
 *
 * @returns The converted string.
 */
export const convertToSnakeCase = (str: string): string => {
  if (!str || str.length === 0) return '';

  return sanitize(str)
    .split(SPLIT_REGEX)
    .map((part) => part.toLowerCase())
    .join('_');
};

/**
 * Utility function to convert a given string to camel-case.
 *
 * @param str – The string to convert.
 *
 * @returns The converted string.
 */
export const convertToCamelCase = (str: string): string => {
  if (!str || str.length === 0) return '';

  return sanitize(str)
    .split(SPLIT_REGEX)
    .map((part, index) => (index === 0 ? part.toLowerCase() : capitalize(part)))
    .join('');
};

/**
 * Utility function to check if the given value is an object.
 *
 * @param value - Object-like value to check.
 */
export const isObject = (value: unknown): boolean =>
  value != null && typeof value === 'object' && Array.isArray(value) === false;

/**
 * Finds all string values that match a given pattern in an object. If needed, it also
 * replaces them.
 *
 * @param obj - The object in which the string values should be found.
 * @param pattern - The string that values can start with.
 * @param replacer - A function that returns the replacement value for each match.
 *
 * @returns Whether the pattern was found in the object.
 */
export const findInObject = (
  obj: NestedObject,
  pattern: string,
  replacer?: (match: string) => string,
): boolean => {
  let found = false;

  for (const key in obj) {
    const value = obj[key];

    if (isObject(value)) {
      found = findInObject(value as NestedObject, pattern, replacer);

      // We're purposefully using `.startsWith` instead of a regex here, because we only
      // want to replace the value if it starts with the pattern, so a regex would be
      // unnecessary performance overhead.
    } else if (typeof value === 'string' && value.startsWith(pattern)) {
      found = true;

      if (replacer) {
        obj[key] = value.replace(pattern, replacer);
      } else {
        return found;
      }
    }
  }

  return found;
};

type NestedObject = {
  [key: string]: unknown | NestedObject;
};

/**
 * Converts an object of nested objects into a flat object, where all keys sit on the
 * same level (at the root).
 *
 * @param obj - The object that should be flattened.
 * @param prefix - An optional path of a nested field to begin the recursion from.
 * @param res - The object that the flattened object should be stored in.
 *
 * @returns A flattened object.
 */
export const flatten = (obj: NestedObject, prefix = '', res: NestedObject = {}) => {
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null) {
      flatten(obj[key] as NestedObject, path, res);
    } else {
      res[path] = obj[key];
    }
  }
  return res;
};

/**
 * Converts a flat object whose keys all sit on the same level (at the root) into an
 * object of nested objects.
 *
 * @param obj - The object that should be expanded.
 *
 * @returns The expanded object.
 */
export const expand = (obj: NestedObject) => {
  return Object.entries(obj).reduce((res, [key, val]) => {
    key
      .split('.')
      .reduce((acc: NestedObject, part: string, i: number, arr: Array<string>) => {
        acc[part] = i === arr.length - 1 ? val : acc[part] || {};
        return acc[part] as NestedObject;
      }, res);
    return res;
  }, {});
};

/**
 * Splits a query into its type, model, and instructions.
 *
 * @param query - The query to split.
 *
 * @returns The type, model, and instructions of the provided query.
 */
export const splitQuery = (query: Query) => {
  // The type of query that is being executed (`create`, `get`, etc).
  const queryType = Object.keys(query)[0] as QueryType;

  // The slug or plural slug of the RONIN model that the query will interact with.
  const queryModel = Object.keys(query[queryType] as QuerySchemaType)[0];

  // The instructions of the query (`with`, `including`, etc).
  const queryInstructions = (query[queryType] as QuerySchemaType)[queryModel];

  return { queryType, queryModel, queryInstructions };
};
