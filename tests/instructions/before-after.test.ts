import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import { CURSOR_NULL_PLACEHOLDER } from '@/src/instructions/before-after';
import type { Query } from '@/src/types/query';

test('get multiple records before cursor', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '1667575193779',
          limitedTo: 100
        },
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
      statement: `SELECT * FROM "accounts" WHERE (("ronin.createdAt" > '2022-11-04T15:19:53.779Z')) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by string field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: 'elaine,1667575193779',
          orderedBy: {
            ascending: ['handle'],
          },
          limitedTo: 100
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
      statement: `SELECT * FROM "accounts" WHERE ((IFNULL("handle", -1e999) < ?1 COLLATE NOCASE) OR ("handle" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "handle" COLLATE NOCASE ASC, "ronin.createdAt" DESC LIMIT 101`,
      params: ['elaine'],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by boolean field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: 'true,1667575193779',
          orderedBy: {
            ascending: ['active'],
          },
          limitedTo: 100
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'active',
          type: 'boolean',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ((IFNULL("active", -1e999) < ?1) OR ("active" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "active" ASC, "ronin.createdAt" DESC LIMIT 101`,
      params: [1],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by number field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '2,1667575193779',
          orderedBy: {
            ascending: ['position'],
          },
          limitedTo: 100
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ((IFNULL("position", -1e999) < ?1) OR ("position" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "position" ASC, "ronin.createdAt" DESC LIMIT 101`,
      params: [2],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by empty string field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
          orderedBy: {
            descending: ['handle'],
          },
          limitedTo: 100
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
      statement: `SELECT * FROM "accounts" WHERE (("handle" IS NOT NULL) OR ("handle" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "handle" COLLATE NOCASE DESC, "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by empty boolean field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
          orderedBy: {
            descending: ['active'],
          },
          limitedTo: 100
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'active',
          type: 'boolean',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("active" IS NOT NULL) OR ("active" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "active" DESC, "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by empty number field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
          orderedBy: {
            descending: ['position'],
          },
          limitedTo: 100
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("position" IS NOT NULL) OR ("position" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "position" DESC, "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor while filtering', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          with: {
            email: null,
          },
          before: '1667575193779',
          limitedTo: 100
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'email',
          type: 'string',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("email" IS NULL) AND (("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});
