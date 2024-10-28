import { expect, test } from 'bun:test';
import { compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';

test('get single record with specific field', () => {
  const query: Query = {
    get: {
      account: {
        selecting: ['id'],
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT "id" FROM "accounts" LIMIT 1');
  expect(values).toMatchObject([]);
});

test('get single record with specific fields', () => {
  const query: Query = {
    get: {
      account: {
        selecting: ['id', 'name'],
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT "id", "name" FROM "accounts" LIMIT 1');
  expect(values).toMatchObject([]);
});
