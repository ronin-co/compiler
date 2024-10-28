import { expect, test } from 'bun:test';
import { compileQueryInput } from '@/src/index';
import { CURSOR_NULL_PLACEHOLDER } from '@/src/instructions/before-after';
import type { Query } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';

test('get multiple records before cursor', () => {
  const query: Query = {
    get: {
      accounts: {
        before: '1667575193779',
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

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE (("ronin.createdAt" > '2022-11-04T15:19:53.779Z')) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([]);
});

test('get multiple records before cursor ordered by string field', () => {
  const query: Query = {
    get: {
      accounts: {
        before: 'elaine,1667575193779',
        orderedBy: {
          ascending: ['handle'],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE ((IFNULL("handle", -1e999) < ?1 COLLATE NOCASE) OR ("handle" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "handle" COLLATE NOCASE ASC, "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject(['elaine']);
});

test('get multiple records before cursor ordered by boolean field', () => {
  const query: Query = {
    get: {
      accounts: {
        before: 'true,1667575193779',
        orderedBy: {
          ascending: ['active'],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'active',
          type: 'boolean',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE ((IFNULL("active", -1e999) < ?1) OR ("active" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "active" ASC, "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([1]);
});

test('get multiple records before cursor ordered by number field', () => {
  const query: Query = {
    get: {
      accounts: {
        before: '2,1667575193779',
        orderedBy: {
          ascending: ['position'],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE ((IFNULL("position", -1e999) < ?1) OR ("position" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "position" ASC, "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([2]);
});

test('get multiple records before cursor ordered by empty string field', () => {
  const query: Query = {
    get: {
      accounts: {
        before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
        orderedBy: {
          descending: ['handle'],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE (("handle" IS NOT NULL) OR ("handle" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "handle" COLLATE NOCASE DESC, "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([]);
});

test('get multiple records before cursor ordered by empty boolean field', () => {
  const query: Query = {
    get: {
      accounts: {
        before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
        orderedBy: {
          descending: ['active'],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'active',
          type: 'boolean',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE (("active" IS NOT NULL) OR ("active" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "active" DESC, "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([]);
});

test('get multiple records before cursor ordered by empty number field', () => {
  const query: Query = {
    get: {
      accounts: {
        before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
        orderedBy: {
          descending: ['position'],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE (("position" IS NOT NULL) OR ("position" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "position" DESC, "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([]);
});

test('get multiple records before cursor while filtering', () => {
  const query: Query = {
    get: {
      accounts: {
        with: {
          email: null,
        },
        before: '1667575193779',
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'email',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "accounts" WHERE (("email" IS NULL) AND (("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject([]);
});
