import type {
  CombinedInstructionsSchema,
  CountInstructionsSchema,
  CountQuerySchema,
  CreateInstructionsSchema,
  CreateQuerySchema,
  DropInstructionsSchema,
  DropQuerySchema,
  ExpressionSchema,
  GetInstructionsSchema,
  GetQuerySchema,
  IncludingInstructionSchema,
  InstructionSchema,
  InstructionsSchema,
  OrderedByInstructionSchema,
  QueryPaginationOptionsSchema,
  QuerySchema,
  QuerySchemaSchema,
  QueryTypeEnum,
  SetInstructionsSchema,
  SetQuerySchema,
  WithInstructionSchema,
} from '@/src/validators/query';
import type { z } from 'zod';

// Get Queries.
export type GetQuery = z.infer<typeof GetQuerySchema>;
export type GetInstructions = z.infer<typeof GetInstructionsSchema>;

// Set Queries.
export type SetQuery = z.infer<typeof SetQuerySchema>;
export type SetInstructions = z.infer<typeof SetInstructionsSchema>;

// Create Queries.
export type CreateQuery = z.infer<typeof CreateQuerySchema>;
export type CreateInstructions = z.infer<typeof CreateInstructionsSchema>;

// Drop Queries.
export type DropQuery = z.infer<typeof DropQuerySchema>;
export type DropInstructions = z.infer<typeof DropInstructionsSchema>;

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
export type QueryType = z.infer<typeof QueryTypeEnum>;
export type QueryPaginationOptions = z.infer<typeof QueryPaginationOptionsSchema>;

export type QuerySchemaType = z.infer<typeof QuerySchemaSchema>;

export interface Statement {
  statement: string;
  params: Array<unknown>;
  returning?: boolean;
}
