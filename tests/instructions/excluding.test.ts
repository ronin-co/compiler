import { expect, test } from 'bun:test';
import { compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';

test('get single record with specific field', () => {
  const query: Query = {
    get: {
      category: {
        selecting: ['id'],
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'category',
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT "id" FROM "categories" LIMIT 1');
  expect(values).toMatchObject([]);
});

test('get single record with specific fields', () => {
  const query: Query = {
    get: {
      beach: {
        selecting: ['id', 'name'],
      },
    },
  };

  const schemas: Array<Schema> = [
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT "id", "name" FROM "beaches" LIMIT 1');
  expect(values).toMatchObject([]);
});
