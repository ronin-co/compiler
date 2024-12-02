import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { SingleRecordResult } from '@/src/types/result';
import { RECORD_ID_REGEX } from '@/src/utils/helpers';

test('get single record with specific field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          selecting: ['id'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "id" FROM "products" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    id: expect.stringMatching(RECORD_ID_REGEX),
  });
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
