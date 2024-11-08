import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

test('inline statement values', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: { handle: 'elaine' },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatements, values } = compileQueries(queries, schemas, {
    inlineValues: true,
  });

  expect(readStatements[0]).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" = "elaine") LIMIT 1',
  );
  expect(values).toMatchObject([]);
});
