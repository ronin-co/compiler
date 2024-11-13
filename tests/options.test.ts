import { expect, test } from 'bun:test';
import { type Model, compileQueries } from '@/src/index';
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

  const models: Array<Model> = [
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

  const statements = compileQueries(queries, models, {
    inlineParams: true,
  });

  expect(statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" = "elaine") LIMIT 1',
      params: [],
      returning: true,
    },
  ]);
});
