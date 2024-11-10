import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

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

  const schemas: Array<Schema> = [
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC, "ronin.createdAt" DESC`,
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

  const schemas: Array<Schema> = [
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" ORDER BY "handle" COLLATE NOCASE ASC, "name" COLLATE NOCASE ASC, "ronin.createdAt" DESC`,
      params: [],
      returning: true,
    },
  ]);
});
