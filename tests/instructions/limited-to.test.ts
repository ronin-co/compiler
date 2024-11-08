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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 21`,
      params: [],
      returning: true,
    },
  ]);
});
