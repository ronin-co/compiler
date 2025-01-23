import { expect, test } from 'bun:test';
import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type {
  AmountResult,
  Result,
  ResultRecord,
  SingleRecordResult,
} from '@/src/types/result';

test('get single record', async () => {
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
      statement:
        'SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "accounts" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.id).toMatch(RECORD_ID_REGEX);
});

test('remove single record', async () => {
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

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.id).toMatch(RECORD_ID_REGEX);
});

test('count multiple records', async () => {
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
      statement: `SELECT (COUNT(*)) as "amount" FROM "accounts"`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as AmountResult;

  expect(result.amount).toBeNumber();
});

test('pass multiple record queries at once', async () => {
  const queries: Array<Query> = [
    {
      count: {
        accounts: null,
      },
    },
    {
      get: {
        accounts: {
          selecting: ['handle'],
        },
      },
    },
    {
      get: {
        account: null,
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
      statement: 'SELECT (COUNT(*)) as "amount" FROM "accounts"',
      params: [],
      returning: true,
    },
    {
      statement: 'SELECT "handle" FROM "accounts"',
      params: [],
      returning: true,
    },
    {
      statement:
        'SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const results = transaction.formatResults(rawResults) as Array<
    Result<Partial<ResultRecord>>
  >;

  // Assert whether the results are provided in the same order as the original queries.
  expect(results).toEqual([
    {
      amount: 2,
    },
    {
      records: [
        {
          handle: 'elaine',
        },
        {
          handle: 'david',
        },
      ],
      modelFields: expect.objectContaining({
        id: 'string',
      }),
    },
    {
      record: {
        id: expect.stringMatching(RECORD_ID_REGEX),
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
        handle: 'elaine',
      },
      modelFields: expect.objectContaining({
        id: 'string',
      }),
    },
  ]);
});
