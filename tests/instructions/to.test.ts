import { expect, test } from 'bun:test';
import { type Schema, compileQuery } from '@/src/index';
import type { Query } from '@/src/types/query';

import { RECORD_ID_REGEX, RONIN_SCHEMA_SYMBOLS, RoninError } from '@/src/utils/helpers';

test('set single record to new string field', () => {
  const query: Query = {
    set: {
      account: {
        with: {
          handle: 'elaine',
        },
        to: {
          handle: 'mia',
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

  expect(readStatement).toBe(
    `UPDATE "accounts" SET "handle" = ?1, "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('mia');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('elaine');
});

test('set single record to new one-cardinality reference field', () => {
  const query: Query = {
    set: {
      member: {
        with: {
          id: 'mem_zgoj3xav8tpcte1s',
        },
        to: {
          account: {
            handle: 'elaine',
          },
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
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'reference',
          target: { slug: 'account' },
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "members" SET "account" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('elaine');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('mem_zgoj3xav8tpcte1s');
});

test('set single record to new many-cardinality reference field', () => {
  const query: Query = {
    set: {
      post: {
        with: {
          id: 'pos_zgoj3xav8tpcte1s',
        },
        to: {
          comments: [{ content: 'Great post!' }],
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'post',
      fields: [
        {
          slug: 'comments',
          type: 'reference',
          target: { slug: 'comment' },
          kind: 'many',
        },
      ],
    },
    {
      slug: 'comment',
      fields: [
        {
          slug: 'content',
          type: 'string',
        },
      ],
    },
  ];

  const { writeStatements, readStatement, values } = compileQuery(query, schemas);

  expect(writeStatements).toEqual([
    'DELETE FROM "ronin_posts_comments" WHERE ("source" = ?1)',
    'INSERT INTO "ronin_posts_comments" ("source", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?2, (SELECT "id" FROM "comments" WHERE ("content" = ?3) LIMIT 1), ?4, ?5, ?6)',
  ]);

  expect(readStatement).toBe(
    'UPDATE "posts" SET "ronin.updatedAt" = ?7 WHERE ("id" = ?8) RETURNING *',
  );

  expect(values[0]).toBe('pos_zgoj3xav8tpcte1s');
  expect(values[1]).toBe('pos_zgoj3xav8tpcte1s');
  expect(values[2]).toBe('Great post!');
  expect(values[3]).toMatch(RECORD_ID_REGEX);
  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[6]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[7]).toBe('pos_zgoj3xav8tpcte1s');
});

test('set single record to new many-cardinality reference field (add)', () => {
  const query: Query = {
    set: {
      post: {
        with: {
          id: 'pos_zgoj3xav8tpcte1s',
        },
        to: {
          comments: {
            containing: [{ content: 'Great post!' }],
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'post',
      fields: [
        {
          slug: 'comments',
          type: 'reference',
          target: { slug: 'comment' },
          kind: 'many',
        },
      ],
    },
    {
      slug: 'comment',
      fields: [
        {
          slug: 'content',
          type: 'string',
        },
      ],
    },
  ];

  const { writeStatements, readStatement, values } = compileQuery(query, schemas);

  expect(writeStatements).toEqual([
    'INSERT INTO "ronin_posts_comments" ("source", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "comments" WHERE ("content" = ?2) LIMIT 1), ?3, ?4, ?5)',
  ]);

  expect(readStatement).toBe(
    'UPDATE "posts" SET "ronin.updatedAt" = ?6 WHERE ("id" = ?7) RETURNING *',
  );

  expect(values[0]).toBe('pos_zgoj3xav8tpcte1s');
  expect(values[1]).toBe('Great post!');
  expect(values[2]).toMatch(RECORD_ID_REGEX);
  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[6]).toBe('pos_zgoj3xav8tpcte1s');
});

test('set single record to new many-cardinality reference field (delete)', () => {
  const query: Query = {
    set: {
      post: {
        with: {
          id: 'pos_zgoj3xav8tpcte1s',
        },
        to: {
          comments: {
            notContaining: [{ content: 'Great post!' }],
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'post',
      fields: [
        {
          slug: 'comments',
          type: 'reference',
          target: { slug: 'comment' },
          kind: 'many',
        },
      ],
    },
    {
      slug: 'comment',
      fields: [
        {
          slug: 'content',
          type: 'string',
        },
      ],
    },
  ];

  const { writeStatements, readStatement, values } = compileQuery(query, schemas);

  expect(writeStatements).toEqual([
    'DELETE FROM "ronin_posts_comments" WHERE ("source" = ?1 AND "target" = (SELECT "id" FROM "comments" WHERE ("content" = ?2) LIMIT 1))',
  ]);

  expect(readStatement).toBe(
    'UPDATE "posts" SET "ronin.updatedAt" = ?3 WHERE ("id" = ?4) RETURNING *',
  );

  expect(values[0]).toBe('pos_zgoj3xav8tpcte1s');
  expect(values[1]).toBe('Great post!');
  expect(values[2]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[3]).toBe('pos_zgoj3xav8tpcte1s');
});

test('set single record to new json field with array', () => {
  const query: Query = {
    set: {
      account: {
        with: {
          handle: 'elaine',
        },
        to: {
          emails: ['elaine@site.co', 'elaine@company.co'],
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
        {
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('["elaine@site.co","elaine@company.co"]');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('elaine');
});

test('set single record to new json field with empty array', () => {
  const query: Query = {
    set: {
      account: {
        with: {
          handle: 'elaine',
        },
        to: {
          emails: [],
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
        {
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('[]');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('elaine');
});

test('set single record to new json field with object', () => {
  const query: Query = {
    set: {
      account: {
        with: {
          handle: 'elaine',
        },
        to: {
          emails: {
            site: 'elaine@site.co',
            hobby: 'dancer@dancing.co',
          },
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
        {
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('{"site":"elaine@site.co","hobby":"dancer@dancing.co"}');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('elaine');
});

test('set single record to new json field with empty object', () => {
  const query: Query = {
    set: {
      account: {
        with: {
          handle: 'elaine',
        },
        to: {
          emails: {},
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
        {
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('{}');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('elaine');
});

test('set single record to new grouped string field', () => {
  const query: Query = {
    set: {
      team: {
        with: {
          id: 'tea_zgoj3xav8tpcte1s',
        },
        to: {
          billing: {
            currency: 'USD',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'billing',
          type: 'group',
        },
        {
          slug: 'billing.currency',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "teams" SET "billing.currency" = ?1, "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('USD');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('tea_zgoj3xav8tpcte1s');
});

test('set single record to new grouped reference field', () => {
  const query: Query = {
    set: {
      team: {
        with: {
          id: 'tea_zgoj3xav8tpcte1s',
        },
        to: {
          billing: {
            manager: {
              handle: 'elaine',
            },
          },
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
    {
      slug: 'team',
      fields: [
        {
          slug: 'billing',
          type: 'group',
        },
        {
          slug: 'billing.manager',
          type: 'reference',
          target: { slug: 'account' },
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "teams" SET "billing.manager" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('elaine');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('tea_zgoj3xav8tpcte1s');
});

test('set single record to new grouped json field', () => {
  const query: Query = {
    set: {
      team: {
        with: {
          id: 'tea_zgoj3xav8tpcte1s',
        },
        to: {
          billing: {
            invoiceRecipients: ['receipts@test.co'],
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'billing',
          type: 'group',
        },
        {
          slug: 'billing.invoiceRecipients',
          type: 'json',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "teams" SET "billing.invoiceRecipients" = IIF("billing.invoiceRecipients" IS NULL, ?1, json_patch("billing.invoiceRecipients", ?1)), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('["receipts@test.co"]');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('tea_zgoj3xav8tpcte1s');
});

test('set single record to result of nested query', () => {
  const query: Query = {
    set: {
      team: {
        with: {
          id: 'tea_zgoj3xav8tpcte1s',
        },
        to: {
          name: {
            [RONIN_SCHEMA_SYMBOLS.QUERY]: {
              get: {
                account: {
                  with: { handle: 'elaine' },
                  selecting: ['name'],
                },
              },
            },
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
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

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    `UPDATE "teams" SET "name" = (SELECT "name" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
  );

  expect(values[0]).toBe('elaine');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('tea_zgoj3xav8tpcte1s');
});

test('create multiple records with nested sub query', () => {
  const query: Query = {
    create: {
      newAccounts: {
        to: {
          [RONIN_SCHEMA_SYMBOLS.QUERY]: {
            get: {
              oldAccounts: null,
            },
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'oldAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'newAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    'INSERT INTO "new_accounts" SELECT * FROM "old_accounts" ORDER BY "ronin.createdAt" DESC LIMIT 101 RETURNING *',
  );

  expect(values).toMatchObject([]);
});

test('create multiple records with nested sub query including additional fields', () => {
  const query: Query = {
    create: {
      newAccounts: {
        to: {
          [RONIN_SCHEMA_SYMBOLS.QUERY]: {
            get: {
              oldAccounts: {
                including: {
                  firstName: 'custom-first-name',
                },
              },
            },
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'oldAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'newAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    'INSERT INTO "new_accounts" SELECT *, ?1 as "firstName" FROM "old_accounts" ORDER BY "ronin.createdAt" DESC LIMIT 101 RETURNING *',
  );

  expect(values[0]).toBe('custom-first-name');
});

test('create multiple records with nested sub query and specific fields', () => {
  const query: Query = {
    create: {
      newAccounts: {
        to: {
          [RONIN_SCHEMA_SYMBOLS.QUERY]: {
            get: {
              oldAccounts: {
                selecting: ['handle'],
              },
            },
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'oldAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'newAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    'INSERT INTO "new_accounts" SELECT "handle", ?1 as "id", ?2 as "ronin.createdAt", ?3 as "ronin.updatedAt" FROM "old_accounts" ORDER BY "ronin.createdAt" DESC LIMIT 101 RETURNING *',
  );

  expect(values[0]).toMatch(RECORD_ID_REGEX);
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('create multiple records with nested sub query and specific meta fields', () => {
  const query: Query = {
    create: {
      newAccounts: {
        to: {
          [RONIN_SCHEMA_SYMBOLS.QUERY]: {
            get: {
              oldAccounts: {
                selecting: ['ronin.updatedAt'],
              },
            },
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'oldAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'newAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQuery(query, schemas);

  expect(readStatement).toBe(
    'INSERT INTO "new_accounts" SELECT "ronin.updatedAt", ?1 as "id", ?2 as "ronin.createdAt" FROM "old_accounts" ORDER BY "ronin.createdAt" DESC LIMIT 101 RETURNING *',
  );

  expect(values[0]).toMatch(RECORD_ID_REGEX);
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('try to create multiple records with nested sub query including non-existent fields', () => {
  const query: Query = {
    create: {
      newAccounts: {
        to: {
          [RONIN_SCHEMA_SYMBOLS.QUERY]: {
            get: {
              oldAccounts: {
                including: {
                  nonExistingField: 'custom-value',
                },
              },
            },
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'oldAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'newAccount',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  let error: Error | undefined;

  try {
    compileQuery(query, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'Field "nonExistingField" defined for `to` does not exist in schema "New Account".',
  );
  expect(error).toHaveProperty('code', 'FIELD_NOT_FOUND');
  expect(error).toHaveProperty('field', 'nonExistingField');
});
