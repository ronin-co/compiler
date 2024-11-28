import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

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

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 21`,
      params: [],
      returning: true,
    },
  ]);
});
