import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { MultipleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS } from '@/src/utils/helpers';

test('get multiple records ordered by field', async () => {
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

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      handle: 'david',
    },
    {
      handle: 'elaine',
    },
  ]);
});

test('get multiple records ordered by expression', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: [
              {
                [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD}firstName || ' ' || ${QUERY_SYMBOLS.FIELD}lastName`,
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

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      firstName: 'David',
      lastName: 'Brown',
    },
    {
      firstName: 'Elaine',
      lastName: 'Jones',
    },
  ]);
});

test('get multiple records ordered by multiple fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          orderedBy: {
            ascending: ['handle', 'lastName'],
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
          slug: 'lastName',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC, "lastName" COLLATE NOCASE ASC`,
      params: [],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      handle: 'david',
      lastName: 'Brown',
    },
    {
      handle: 'elaine',
      lastName: 'Jones',
    },
  ]);
});
