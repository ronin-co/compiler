import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

test('get single record with specific field', () => {
  const queries: Array<Query> = [
    {
      get: {
        category: {
          selecting: ['id'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'category',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "id" FROM "categories" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);
});

test('get single record with specific fields', () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          selecting: ['id', 'name'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "id", "name" FROM "beaches" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);
});
