import { expect, test } from 'bun:test';
import { type Schema, compileQuery } from '@/src/index';
import type { Query } from '@/src/types/query';

test('get single record', () => {
  const query: Query = {
    get: {
      account: null,
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "accounts" LIMIT 1');
  expect(values).toMatchObject([]);
});

test('drop single record', () => {
  const query: Query = {
    drop: {
      account: {
        with: {
          handle: 'elaine',
        },
      },
    },
  };

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

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe('DELETE FROM "accounts" WHERE ("handle" = ?1) RETURNING *');
  expect(values).toMatchObject(['elaine']);
});

test('count multiple records', () => {
  const query: Query = {
    count: {
      accounts: null,
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `SELECT COUNT(*) FROM "accounts" ORDER BY "ronin.createdAt" DESC`,
  );
  expect(values).toMatchObject([]);
});
