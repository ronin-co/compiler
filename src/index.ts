import type { Query, Statement } from "@/src/types/query";
import type { PublicSchema } from "@/src/types/schema";
import { compileQueryInput } from "@/src/utils";
import {
	addDefaultSchemaFields,
	addDefaultSchemaShortcuts,
	addSystemSchemas,
} from "@/src/utils/schema";

/**
 * Composes SQL statements for the provided RONIN queries.
 *
 * @param queries - The RONIN queries for which SQL statements should be composed.
 * @param schemas - A list of schemas.
 * @param options - Additional options to adjust the behavior of the statement generation.
 *
 * @returns The composed SQL statements.
 */
export const compileQueries = (
	queries: Array<Query>,
	schemas: Array<PublicSchema>,
	options?: {
		inlineValues?: boolean;
	},
): Array<Statement> => {
	const schemaList = addSystemSchemas(schemas).map((schema) => {
		return addDefaultSchemaFields(schema, true);
	});

	const schemaListWithShortcuts = schemaList.map((schema) => {
		return addDefaultSchemaShortcuts(schemaList, schema);
	});

	const dependencyStatements: Array<Statement> = [];
	const mainStatements: Array<Statement> = [];

	for (const query of queries) {
		const result = compileQueryInput(
			query,
			schemaListWithShortcuts,
			options?.inlineValues ? null : [],
		);

		// Every query can only produce one main statement (which can return output), but
		// multiple dependency statements (which must be executed before the main one, but
		// cannot return output themselves).
		dependencyStatements.push(...result.dependencies);
		mainStatements.push(result.main);
	}

	// First return all dependency statements, and then all main statements. This is
	// essential since the dependency statements are expected to not produce any output, so
	// they should be executed first. The main statements, on the other hand, are expected
	// to produce output, and that output should be a 1:1 match between RONIN queries and
	// SQL statements, meaning one RONIN query should produce one main SQL statement.
	return [...dependencyStatements, ...mainStatements];
};

// Expose schema types
export type {
	PublicSchema as Schema,
	SchemaField,
	SchemaIndex,
	SchemaTrigger,
} from "@/src/types/schema";

// Expose query types
export type { Query, Statement } from "@/src/types/query";
