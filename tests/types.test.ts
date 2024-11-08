import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

test('get single record', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: null,
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('drop single record', () => {
  const queries: Array<Query> = [
    {
      drop: {
        account: {
          with: {
            handle: 'elaine',
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
      statement: 'DELETE FROM "accounts" WHERE ("handle" = ?1) RETURNING *',
      params: ['elaine'],
      returning: true,
    },
  ]);
});

test('count multiple records', () => {
  const queries: Array<Query> = [
    {
      count: {
        accounts: null,
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT COUNT(*) FROM "accounts" ORDER BY "ronin.createdAt" DESC`,
      params: [],
      returning: true,
    },
  ]);
});
