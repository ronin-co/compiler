import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';
import { RONIN_MODEL_SYMBOLS } from '@/src/utils/helpers';

test('get multiple records ordered by field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: ['handle'],
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
      statement: `SELECT * FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records ordered by expression', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: [
              {
                [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD}firstName || ' ' || ${RONIN_MODEL_SYMBOLS.FIELD}lastName`,
              },
            ],
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
          slug: 'firstName',
          type: 'string',
        },
        {
          slug: 'lastName',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" ORDER BY ("firstName" || ' ' || "lastName") ASC`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records ordered by multiple fields', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: ['handle', 'name'],
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
      statement: `SELECT * FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC, "name" COLLATE NOCASE ASC`,
      params: [],
      returning: true,
    },
  ]);
});
