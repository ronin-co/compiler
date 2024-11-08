import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

test('inline statement values', () => {
  const query: Query = {
    get: {
      account: {
        with: { handle: 'elaine' },
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

  const { readStatement, values } = compileQueries(query, schemas, {
    inlineValues: true,
  });

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" = "elaine") LIMIT 1',
  );
  expect(values).toMatchObject([]);
});
