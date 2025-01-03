import { expect, test } from 'bun:test';
import { RECORD_ID_REGEX, queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { SingleRecordResult } from '@/src/types/result';

test('get single record with specific field', async () => {
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

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
  });
});

test('get single record with specific fields', async () => {
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

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
  });
});
