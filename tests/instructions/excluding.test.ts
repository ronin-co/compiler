import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

test('get single record with specific field', () => {
  const queries: Array<Query> = [
    {
      get: {
        category: {
          selecting: ['id'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'category',
    },
  ];

  const { readStatements, values } = compileQueries(queries, schemas);

  expect(readStatements[0]).toBe('SELECT "id" FROM "categories" LIMIT 1');
  expect(values).toMatchObject([]);
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

  const { readStatements, values } = compileQueries(queries, schemas);

  expect(readStatements[0]).toBe('SELECT "id", "name" FROM "beaches" LIMIT 1');
  expect(values).toMatchObject([]);
});
