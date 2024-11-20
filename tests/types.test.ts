import { expect, test } from 'bun:test';
import { type Model, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

test('get single record', () => {
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

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('remove single record', () => {
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

  const statements = compileQueries(queries, models);

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

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: `SELECT COUNT(*) FROM "accounts"`,
      params: [],
      returning: true,
    },
  ]);
});
