import { RONIN_MODEL_SYMBOLS } from '@/src/utils/helpers';
import { z } from 'zod';

// Query Types.
export const QueryTypeEnum = z.enum([
  'get',
  'set',
  'drop',
  'create',
  'count',
  'addModel',
  'alterModel',
  'removeModel',
  'addField',
  'alterField',
  'removeField',
  'addIndex',
  'alterIndex',
  'removeIndex',
  'addTrigger',
  'alterTrigger',
  'removeTrigger',
  'addPreset',
  'alterPreset',
  'removePreset',
]);

// Record.
export const FieldValue = z.union(
  [z.string(), z.number(), z.boolean(), z.null(), z.any()],
  {
    invalid_type_error:
      'The value of a field must either be a string, number, boolean or null.',
  },
);
export const FieldSelector = z.record(FieldValue);

// Expression
export const ExpressionSchema = z.object({
  [RONIN_MODEL_SYMBOLS.EXPRESSION]: z.string(),
});

// With Instructions.
export const WithInstructionRefinementTypes = z.enum([
  'being',
  'notBeing',
  'startingWith',
  'endingWith',
  'containing',
  'greaterThan',
  'lessThan',
]);

export const WithInstructionRefinementSchema = z.union([
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

export const WithInstructionSchema = z.record(
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
export const IncludingInstructionSchema = z.record(
  z.union([z.string(), z.lazy((): z.ZodTypeAny => GetQuerySchema)]),
);

// Ordering Instructions.
export const OrderedByInstructionSchema = z
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
export const ForInstructionSchema = z.union([z.array(z.string()), z.record(z.string())]);

// Query Instructions.
export const InstructionsSchema = z.object({
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
export const GetInstructionsSchema = InstructionsSchema.partial().omit({
  to: true,
});
export const GetQuerySchema = z.object({
  get: z.record(z.string(), GetInstructionsSchema.nullable()),
});

// Set Queries.
export const SetInstructionsSchema = InstructionsSchema.partial().extend({
  to: FieldSelector.refine(
    (value) => Object.keys(value).length > 0,
    'The `to` instruction must not be empty.',
  ),
});
export const SetQuerySchema = z.object({
  set: z.record(z.string(), SetInstructionsSchema),
});

// Create Queries.
export const CreateInstructionsSchema = InstructionsSchema.partial()
  .omit({ with: true, for: true })
  .extend({
    to: FieldSelector.refine(
      (value) => Object.keys(value).length > 0,
      'The `to` instruction must not be empty.',
    ),
  });
export const CreateQuerySchema = z.object({
  create: z.record(z.string(), CreateInstructionsSchema),
});

// Drop Queries.
export const DropInstructionsSchema = InstructionsSchema.partial().omit({
  to: true,
});
export const DropQuerySchema = z.object({
  drop: z.record(z.string(), DropInstructionsSchema),
});

// Count Queries.
export const CountInstructionsSchema = InstructionsSchema.partial().omit({
  to: true,
});
export const CountQuerySchema = z.object({
  count: z.record(z.string(), CountInstructionsSchema.nullable()),
});

// Query Instructions.
export const CombinedInstructionsSchema = z.union([
  SetInstructionsSchema,
  CountInstructionsSchema,
  CreateInstructionsSchema,
  DropInstructionsSchema,
  GetInstructionsSchema,
]);
export const InstructionSchema = z.enum([
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

export const QuerySchemaSchema = z.record(InstructionsSchema.partial());

export const QuerySchema = z
  .object({
    [QueryTypeEnum.Enum.count]: z.record(z.string(), CountInstructionsSchema.nullable()),
    [QueryTypeEnum.Enum.create]: z.record(z.string(), CreateInstructionsSchema),
    [QueryTypeEnum.Enum.drop]: z.record(z.string(), DropInstructionsSchema),
    [QueryTypeEnum.Enum.get]: z.record(z.string(), GetInstructionsSchema.nullable()),
    [QueryTypeEnum.Enum.set]: z.record(z.string(), SetInstructionsSchema),

    [QueryTypeEnum.Enum.addModel]: z.record(z.string(), z.any()),
    [QueryTypeEnum.Enum.alterModel]: z.union([
      z.string(),
      z.tuple([z.string(), z.record(z.string(), z.any())]),
    ]),
    [QueryTypeEnum.Enum.removeModel]: z.string(),

    [QueryTypeEnum.Enum.addField]: z.record(z.string(), z.any()),
    [QueryTypeEnum.Enum.alterField]: z.tuple([z.string(), z.record(z.string(), z.any())]),
    [QueryTypeEnum.Enum.removeField]: z.string(),

    [QueryTypeEnum.Enum.addIndex]: z.record(z.string(), z.any()),
    [QueryTypeEnum.Enum.alterIndex]: z.tuple([z.string(), z.record(z.string(), z.any())]),
    [QueryTypeEnum.Enum.removeIndex]: z.string(),

    [QueryTypeEnum.Enum.addTrigger]: z.record(z.string(), z.any()),
    [QueryTypeEnum.Enum.alterTrigger]: z.tuple([
      z.string(),
      z.record(z.string(), z.any()),
    ]),
    [QueryTypeEnum.Enum.removeTrigger]: z.string(),

    [QueryTypeEnum.Enum.addPreset]: z.record(z.string(), z.any()),
    [QueryTypeEnum.Enum.alterPreset]: z.tuple([
      z.string(),
      z.record(z.string(), z.any()),
    ]),
    [QueryTypeEnum.Enum.removePreset]: z.string(),
  })
  .partial();

// Pagination Options.
export const QueryPaginationOptionsSchema = z.object({
  moreBefore: z.string().nullish(),
  moreAfter: z.string().nullish(),
});
