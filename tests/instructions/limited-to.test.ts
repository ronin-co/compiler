import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

test('get multiple records limited to amount', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          limitedTo: 20,
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const { readStatements, values } = compileQueries(queries, schemas);

  expect(readStatements[0]).toBe(
    `SELECT * FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 21`,
  );
  expect(values).toMatchObject([]);
});
