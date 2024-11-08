import { expect, test } from 'bun:test';
import { type Schema, compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';

test('get multiple records limited to amount', () => {
  const query: Query = {
    get: {
      accounts: {
        limitedTo: 20,
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 21`,
  );
  expect(values).toMatchObject([]);
});
