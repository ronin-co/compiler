import { z } from 'zod';

// Query Types.
const QueryTypeEnum = z.enum(['get', 'set', 'add', 'remove', 'count']);

// Model Query Types.
const ModelQueryTypeEnum = z.enum(['create', 'alter', 'drop']);
const ModelEntityEnum = z.enum(['field', 'index', 'trigger', 'preset']);

// Record.
const FieldValue = z.union([z.string(), z.number(), z.boolean(), z.null(), z.any()], {
  invalid_type_error:
    'The value of a field must either be a string, number, boolean or null.',
});
const FieldSelector = z.record(FieldValue);

// Expression
const ExpressionSchema = z.object({
  __RONIN_EXPRESSION: z.string(),
});

// With Instructions.
const WithInstructionRefinementTypes = z.enum([
  'being',
  'notBeing',
  'startingWith',
  'endingWith',
  'containing',
  'greaterThan',
  'lessThan',
]);

const WithInstructionRefinementSchema = z.union([
  FieldValue,
  z
    .object({
      being: z.union([FieldValue, z.array(FieldValue)]),
      notBeing: z.union([FieldValue, z.array(FieldValue)]),

      startingWith: z.union([FieldValue, z.array(FieldValue)]),
      notStartingWith: z.union([FieldValue, z.array(FieldValue)]),

      endingWith: z.union([FieldValue, z.array(FieldValue)]),
      notEndingWith: z.union([FieldValue, z.array(FieldValue)]),

      containing: z.union([FieldValue, z.array(FieldValue)]),
      notContaining: z.union([FieldValue, z.array(FieldValue)]),

      greaterThan: z.union([FieldValue, z.array(FieldValue)]),
      greaterOrEqual: z.union([FieldValue, z.array(FieldValue)]),

      lessThan: z.union([FieldValue, z.array(FieldValue)]),
      lessOrEqual: z.union([FieldValue, z.array(FieldValue)]),
    })
    .partial()
    .strict(
      `A \`with\` instruction can only contain the following refinements: ${WithInstructionRefinementTypes.options
        .map((refinementType) => `\`${refinementType}\``)
        .join(', ')}.`,
    )
    .refine((value) => Object.keys(value).length > 0, {
      message: 'A `with` instruction can not be empty.',
    }),
]);

const WithInstructionSchema = z.record(
  z.union([
    // `with: { field: 'value' }
    // `with: { field: { containing: 'value' } }
    // `with: { field: { containing: ['value'] } }
    WithInstructionRefinementSchema,

    // `with: { relatedRecord: { field: 'value' } }
    // `with: { relatedRecord: { field: { containing: 'value' } } }
    // `with: { relatedRecord: { field: { containing: ['value'] } } }
    z.record(WithInstructionRefinementSchema),

    z
      .array(
        z.union([
          // `with: { field: ['value'] }
          // `with: { field: [{ containing: 'value' }] }
          // `with: { field: [{ containing: ['value'] }] }
          WithInstructionRefinementSchema,

          // `with: { relatedRecord: [{ field: 'value' }] }
          // `with: { relatedRecord: [{ field: { containing: 'value' } }] }
          // `with: { relatedRecord: [{ field: { containing: ['value'] } }] }
          // `with: { relatedRecord: [{ containing: 'value', { field: { containing: 'value' } } }] }
          // `with: { relatedRecord: [{ containing: ['value'], { field: { containing: ['value'] } } }] }
          z.record(WithInstructionRefinementSchema),
        ]),
      )
      .min(1, 'If an array of refinements is passed, it must not be empty.'),

    // `with: { relatedRecord: { field: ['value'] } }`
    // `with: { relatedRecord: { field: [{ containing: 'value' }] } }`
    // `with: { relatedRecord: { field: [{ containing: ['value'] }] } }`
    z
      .record(
        z.array(
          z.union([
            WithInstructionRefinementSchema,
            z.record(WithInstructionRefinementSchema),
          ]),
        ),
      )
      .refine((value) => Object.keys(value).length > 0, {
        message: 'A `with` instruction for a related record cannot be empty.',
      }),
  ]),
);

// Including Instructions.
const IncludingInstructionSchema = z.record(
  z.union([z.string(), z.lazy((): z.ZodTypeAny => GetQuerySchema)]),
);

// Ordering Instructions.
const OrderedByInstructionSchema = z
  .object({
    ascending: z
      .array(
        z.union([
          z.string({
            invalid_type_error:
              'The `orderedBy.ascending` instruction must be an array of field slugs or expressions.',
          }),
          ExpressionSchema,
        ]),
        {
          invalid_type_error:
            'The `orderedBy.ascending` instruction must be an array of field slugs or expressions.',
        },
      )
      .optional(),
    descending: z
      .array(
        z.union([
          z.string({
            invalid_type_error:
              'The `orderedBy.descending` instruction must be an array of field slugs or expressions.',
          }),
          ExpressionSchema,
        ]),
        {
          invalid_type_error:
            'The `orderedBy.descending` instruction must be an array of field slugs or expressions.',
        },
      )
      .optional(),
  })
  .optional();

// For Instructions.
const ForInstructionSchema = z.union([z.array(z.string()), z.record(z.string())]);

// Query Instructions.
const InstructionsSchema = z.object({
  with: z.union(
    [
      WithInstructionSchema.refine((value) => Object.keys(value).length > 0, {
        message: 'A `with` instruction must reference at least one field.',
      }),
      z
        .array(
          WithInstructionSchema.refine((value) => Object.keys(value).length > 0, {
            message: 'A `with` instruction must reference at least one field.',
          }),
        )
        .min(1, 'If an array is passed as `with`, it must not be empty.'),
    ],
    {
      errorMap: () => ({
        message: 'A `with` instruction must either be an object or an array of objects.',
      }),
    },
  ),

  to: FieldSelector.refine(
    (value) => Object.keys(value).length > 0,
    'The `to` instruction must not be empty.',
  ),

  including: IncludingInstructionSchema,

  selecting: z.array(
    z.string({
      invalid_type_error: 'The `selecting` instruction must be an array of strings.',
    }),
  ),

  orderedBy: OrderedByInstructionSchema,

  before: z.union([z.string(), z.null()], {
    errorMap: () => ({ message: 'The `before` instruction must be a string.' }),
  }),

  after: z.union([z.string(), z.null()], {
    errorMap: () => ({ message: 'The `after` instruction must be a string.' }),
  }),

  limitedTo: z
    .number({
      invalid_type_error: 'The `limitedTo` instruction must be a number.',
    })
    .min(1, 'The `limitedTo` instruction must be greater than or equal to 1.')
    .max(1000, 'The `limitedTo` instruction must be less than or equal to 1000.'),

  for: ForInstructionSchema,
});

// Get Queries.
const GetInstructionsSchema = InstructionsSchema.partial().omit({
  to: true,
});
const GetQuerySchema = z.object({
  get: z.record(z.string(), GetInstructionsSchema.nullable()),
});

// Set Queries.
const SetInstructionsSchema = InstructionsSchema.partial().extend({
  to: FieldSelector.refine(
    (value) => Object.keys(value).length > 0,
    'The `to` instruction must not be empty.',
  ),
});
const SetQuerySchema = z.object({
  set: z.record(z.string(), SetInstructionsSchema),
});

// Add Queries.
const AddInstructionsSchema = InstructionsSchema.partial()
  .omit({ with: true, for: true })
  .extend({
    to: FieldSelector.refine(
      (value) => Object.keys(value).length > 0,
      'The `to` instruction must not be empty.',
    ),
  });
const AddQuerySchema = z.object({
  add: z.record(z.string(), AddInstructionsSchema),
});

// Drop Queries.
const RemoveInstructionsSchema = InstructionsSchema.partial().omit({
  to: true,
});
const RemoveQuerySchema = z.object({
  remove: z.record(z.string(), RemoveInstructionsSchema),
});

// Count Queries.
const CountInstructionsSchema = InstructionsSchema.partial().omit({
  to: true,
});
const CountQuerySchema = z.object({
  count: z.record(z.string(), CountInstructionsSchema.nullable()),
});

// Query Instructions.
const CombinedInstructionsSchema = z.union([
  SetInstructionsSchema,
  CountInstructionsSchema,
  AddInstructionsSchema,
  RemoveInstructionsSchema,
  GetInstructionsSchema,
]);
const InstructionSchema = z.enum([
  'with',
  'to',
  'including',
  'selecting',
  'orderedBy',
  'orderedBy.ascending',
  'orderedBy.descending',
  'before',
  'after',
  'limitedTo',
  'for',
]);

const QuerySchemaSchema = z.record(InstructionsSchema.partial());

const QuerySchema = z
  .object({
    [QueryTypeEnum.Enum.get]: z.record(z.string(), GetInstructionsSchema.nullable()),
    [QueryTypeEnum.Enum.set]: z.record(z.string(), SetInstructionsSchema),
    [QueryTypeEnum.Enum.add]: z.record(z.string(), AddInstructionsSchema),
    [QueryTypeEnum.Enum.remove]: z.record(z.string(), RemoveInstructionsSchema),
    [QueryTypeEnum.Enum.count]: z.record(z.string(), CountInstructionsSchema.nullable()),

    [ModelQueryTypeEnum.Enum.create]: z.union([
      z.object({
        model: z.string(),
        to: z.record(z.string(), z.any()),
      }),
      z.object({
        model: z.record(z.string(), z.any()),
      }),
    ]),

    [ModelQueryTypeEnum.Enum.alter]: z
      .object({
        model: z.string(),
      })
      .and(
        z.union([
          z.object({
            to: z.record(z.string(), z.any()),
          }),
          z.object({
            [ModelQueryTypeEnum.Enum.create]: z.union([
              z.record(ModelEntityEnum, z.string()).and(
                z.object({
                  to: z.record(z.string(), z.any()),
                }),
              ),
              z.record(ModelEntityEnum, z.record(z.string(), z.any())),
            ]),
          }),
          z.object({
            [ModelQueryTypeEnum.Enum.alter]: z.record(ModelEntityEnum, z.string()).and(
              z.object({
                to: z.record(z.string(), z.any()),
              }),
            ),
          }),
          z.object({
            [ModelQueryTypeEnum.Enum.drop]: z.record(ModelEntityEnum, z.string()),
          }),
        ]),
      ),

    [ModelQueryTypeEnum.Enum.drop]: z.object({
      model: z.string(),
    }),
  })
  .partial();

// Pagination Options.
const QueryPaginationOptionsSchema = z.object({
  moreBefore: z.string().nullish(),
  moreAfter: z.string().nullish(),
});

// Get Queries.
export type GetQuery = z.infer<typeof GetQuerySchema>;
export type GetInstructions = z.infer<typeof GetInstructionsSchema>;

// Set Queries.
export type SetQuery = z.infer<typeof SetQuerySchema>;
export type SetInstructions = z.infer<typeof SetInstructionsSchema>;

// Add Queries.
export type AddQuery = z.infer<typeof AddQuerySchema>;
export type AddInstructions = z.infer<typeof AddInstructionsSchema>;

// Remove Queries.
export type RemoveQuery = z.infer<typeof RemoveQuerySchema>;
export type RemoveInstructions = z.infer<typeof RemoveInstructionsSchema>;

// Count Queries.
export type CountQuery = z.infer<typeof CountQuerySchema>;
export type CountInstructions = z.infer<typeof CountInstructionsSchema>;

// With Instructions.
export type WithInstruction = z.infer<typeof WithInstructionSchema>;

// Including Instructions.
export type IncludingInstruction = z.infer<typeof IncludingInstructionSchema>;

// Ordering Instructions.
export type OrderedByInstrucion = z.infer<typeof OrderedByInstructionSchema>;

// Expressions.
export type Expression = z.infer<typeof ExpressionSchema>;

/**
 * Union of the instructions for all query types. It requires or disallows fields
 * depending on the type of the query.
 *
 * For example: If `query.type` is `set`, `to` is required. The other way around,
 * if the query type is not `set`, `to` is not allowed.
 */
export type Instructions = z.infer<typeof CombinedInstructionsSchema>;
export type QueryInstructionType = z.infer<typeof InstructionSchema>;

/**
 * Type containing all possible query instructions, regardless of the type of
 * the query.
 */
export type CombinedInstructions = z.infer<typeof InstructionsSchema>;

export type Query = z.infer<typeof QuerySchema>;
export type QueryType =
  | z.infer<typeof QueryTypeEnum>
  | z.infer<typeof ModelQueryTypeEnum>;
export type QueryPaginationOptions = z.infer<typeof QueryPaginationOptionsSchema>;

export type QuerySchemaType = z.infer<typeof QuerySchemaSchema>;

export type ModelQueryType = z.infer<typeof ModelQueryTypeEnum>;
export type ModelEntityType = z.infer<typeof ModelEntityEnum>;
