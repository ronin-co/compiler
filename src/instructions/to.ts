import type { Model } from '@/src/types/model';
import type { SetInstructions, Statement } from '@/src/types/query';
import {
  expand,
  flatten,
  generateRecordId,
  isObject,
  splitQuery,
} from '@/src/utils/helpers';
import { compileQueryInput } from '@/src/utils/index';
import {
  composeAssociationModelSlug,
  getFieldFromModel,
  getModelBySlug,
} from '@/src/utils/model';
import { composeConditions, getSymbol } from '@/src/utils/statement';

/**
 * Generates the SQL syntax for the `to` query instruction, which allows for providing
 * values that should be stored in the records that are being addressed.
 *
 * @param models - A list of models.
 * @param model - The model being addressed in the query.
 * @param statementParams - A collection of values that will automatically be
 * inserted into the query by SQLite.
 * @param queryType - The type of query that is being executed.
 * @param dependencyStatements - A list of SQL statements to be executed before the main
 * SQL statement, in order to prepare for it.
 * @param instructions - The `to` and `with` instruction included in the query.
 * @param options - Additional options for customizing the behavior of the function.
 *
 * @returns The SQL syntax for the provided `to` instruction.
 */
export const handleTo = (
  models: Array<Model>,
  model: Model,
  statementParams: Array<unknown> | null,
  queryType: 'create' | 'set',
  dependencyStatements: Array<Statement>,
  instructions: {
    with: NonNullable<SetInstructions['with']> | undefined;
    to: NonNullable<SetInstructions['to']>;
  },
  options?: { parentTable?: string },
): string => {
  const currentTime = new Date().toISOString();
  const { with: withInstruction, to: toInstruction } = instructions;

  const defaultFields: Record<string, unknown> = {};

  // If records are being created, assign a default ID to them, unless a custom ID was
  // already provided in the query.
  if (queryType === 'create') {
    defaultFields.id = toInstruction.id || generateRecordId(model.idPrefix);
  }

  defaultFields.ronin = {
    // If records are being created, set their creation time.
    ...(queryType === 'create' ? { createdAt: currentTime } : {}),
    // If records are being created or updated, set their update time.
    updatedAt: currentTime,
    // Allow for overwriting the default values provided above.
    ...toInstruction.ronin,
  };

  // Check whether a query resides at the root of the `to` instruction.
  const symbol = getSymbol(toInstruction);

  // If a sub query is provided as the `to` instruction, we don't need to compute a list
  // of fields and/or values for the SQL query, since the fields and values are all
  // derived from the sub query. This allows us to keep the SQL statement lean.
  if (symbol?.type === 'query') {
    let { queryModel: subQueryModelSlug, queryInstructions: subQueryInstructions } =
      splitQuery(symbol.value);
    const subQueryModel = getModelBySlug(models, subQueryModelSlug);

    const subQuerySelectedFields = subQueryInstructions?.selecting;
    const subQueryIncludedFields = subQueryInstructions?.including;

    // Determine which fields will be returned by the sub query.
    const subQueryFields = [
      ...(subQuerySelectedFields ||
        (subQueryModel.fields || []).map((field) => field.slug)),
      ...(subQueryIncludedFields
        ? Object.keys(
            flatten((subQueryIncludedFields || {}) as unknown as Record<string, unknown>),
          )
        : []),
    ];

    // Ensure that every field returned by the sub query is present in the model
    // of the root query, otherwise the fields of the sub query can't be used.
    for (const field of subQueryFields || []) {
      getFieldFromModel(model, field, 'to');
    }

    const defaultFieldsToAdd = subQuerySelectedFields
      ? Object.entries(flatten(defaultFields)).filter(([key]) => {
          return !subQuerySelectedFields.includes(key);
        })
      : [];

    // If the sub query selects only a subset of fields from its model using
    // `selecting`, there is a chance that the fields returned by the sub query will not
    // include the metadata fields of the retrieved records.
    //
    // In that case, we need to instruct the sub query to explicitly return the default
    // fields for the records in the root query, otherwise the records in the root query
    // will be missing the metadata fields, since they won't come from the sub query.
    //
    // In other words, by default, the metadata fields of the root query will be provided
    // by the sub query. If the sub query doesn't provide them, we need to "fill in" the
    // missing metadata fields.
    if (defaultFieldsToAdd.length > 0) {
      const defaultFieldsObject = expand(Object.fromEntries(defaultFieldsToAdd));

      if (!subQueryInstructions) subQueryInstructions = {};

      subQueryInstructions.including = {
        ...defaultFieldsObject,
        ...(subQueryInstructions.including as object),
      } as unknown as Array<string>;
    }

    return compileQueryInput(symbol.value, models, statementParams).main.statement;
  }

  // Assign default field values to the provided instruction.
  Object.assign(toInstruction, defaultFields);

  // For reference fields of the cardinality "many", we need to compose separate
  // queries for managing the records in the associative model, which is the model
  // that is used to establish the relationship between two other models, as those two
  // do not share a direct reference.
  for (const fieldSlug in toInstruction) {
    const fieldValue = toInstruction[fieldSlug];
    const fieldDetails = getFieldFromModel(model, fieldSlug, 'to');

    if (fieldDetails.field.type === 'reference' && fieldDetails.field.kind === 'many') {
      // Remove the field from the `to` instruction as it will be handled using
      // separate queries.
      delete toInstruction[fieldSlug];

      const associativeModelSlug = composeAssociationModelSlug(model, fieldDetails.field);

      const composeStatement = (
        subQueryType: 'create' | 'drop',
        value?: unknown,
      ): Statement => {
        const source =
          queryType === 'create' ? { id: toInstruction.id } : withInstruction;
        const recordDetails: Record<string, unknown> = { source };

        if (value) recordDetails.target = value;

        return compileQueryInput(
          {
            [subQueryType]: {
              [associativeModelSlug]:
                subQueryType === 'create'
                  ? { to: recordDetails }
                  : { with: recordDetails },
            },
          },
          models,
          [],
          { returning: false },
        ).main;
      };

      if (Array.isArray(fieldValue)) {
        dependencyStatements.push(composeStatement('drop'));

        for (const record of fieldValue) {
          dependencyStatements.push(composeStatement('create', record));
        }
      } else if (isObject(fieldValue)) {
        for (const recordToAdd of fieldValue.containing || []) {
          dependencyStatements.push(composeStatement('create', recordToAdd));
        }

        for (const recordToRemove of fieldValue.notContaining || []) {
          dependencyStatements.push(composeStatement('drop', recordToRemove));
        }
      }
    }
  }

  let statement = composeConditions(models, model, statementParams, 'to', toInstruction, {
    ...options,
    type: queryType === 'create' ? 'fields' : undefined,
  });

  if (queryType === 'create') {
    const deepStatement = composeConditions(
      models,
      model,
      statementParams,
      'to',
      toInstruction,
      {
        ...options,
        type: 'values',
      },
    );

    statement = `(${statement}) VALUES (${deepStatement})`;
  } else if (queryType === 'set') {
    statement = `SET ${statement}`;
  }

  return statement;
};
