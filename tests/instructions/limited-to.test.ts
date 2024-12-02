import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { MultipleRecordResult } from '@/src/types/result';
import { PAGINATION_CURSOR_REGEX } from '@/src/utils/helpers';

test('get multiple records limited to amount', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          limitedTo: 2,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "beaches" ORDER BY "ronin.createdAt" DESC LIMIT 3',
      params: [],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as MultipleRecordResult;

  expect(result.records).toHaveLength(2);
  expect(result.moreBefore).toBeUndefined();
  expect(result.moreAfter).toMatch(PAGINATION_CURSOR_REGEX);
});
