import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

test('get single record', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: null,
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
      statement: `SELECT * FROM "accounts" LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('remove single record', () => {
  const queries: Array<Query> = [
    {
      remove: {
        account: {
          with: {
            handle: 'elaine',
          },
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'DELETE FROM "accounts" WHERE ("handle" = ?1) RETURNING *',
      params: ['elaine'],
      returning: true,
    },
  ]);
});

test('count multiple records', () => {
  const queries: Array<Query> = [
    {
      count: {
        accounts: null,
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
      statement: `SELECT COUNT(*) FROM "accounts"`,
      params: [],
      returning: true,
    },
  ]);
});
