import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  RONIN_SCHEMA_SYMBOLS,
  RoninError,
} from '@/src/utils/helpers';

test('set single record to new string field', () => {
  const queries: Array<Query> = [
    {
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
      statement: `UPDATE "accounts" SET "handle" = ?1, "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: ['mia', expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'elaine'],
      returning: true,
    },
  ]);
});

test('set single record to new one-cardinality reference field', () => {
  const queries: Array<Query> = [
    {
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "members" SET "account" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'elaine',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'mem_zgoj3xav8tpcte1s',
      ],
      returning: true,
    },
  ]);
});

test('set single record to new many-cardinality reference field', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: 'DELETE FROM "ronin_post_comments" WHERE ("source" = ?1)',
      params: ['pos_zgoj3xav8tpcte1s'],
    },
    {
      statement:
        'INSERT INTO "ronin_post_comments" ("source", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "comments" WHERE ("content" = ?2) LIMIT 1), ?3, ?4, ?5)',
      params: [
        'pos_zgoj3xav8tpcte1s',
        'Great post!',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'UPDATE "posts" SET "ronin.updatedAt" = ?1 WHERE ("id" = ?2) RETURNING *',
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'pos_zgoj3xav8tpcte1s'],
      returning: true,
    },
  ]);
});

test('set single record to new many-cardinality reference field (add)', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'INSERT INTO "ronin_post_comments" ("source", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "comments" WHERE ("content" = ?2) LIMIT 1), ?3, ?4, ?5)',
      params: [
        'pos_zgoj3xav8tpcte1s',
        'Great post!',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'UPDATE "posts" SET "ronin.updatedAt" = ?1 WHERE ("id" = ?2) RETURNING *',
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'pos_zgoj3xav8tpcte1s'],
      returning: true,
    },
  ]);
});

test('set single record to new many-cardinality reference field (delete)', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'DELETE FROM "ronin_post_comments" WHERE ("source" = ?1 AND "target" = (SELECT "id" FROM "comments" WHERE ("content" = ?2) LIMIT 1))',
      params: ['pos_zgoj3xav8tpcte1s', 'Great post!'],
    },
    {
      statement:
        'UPDATE "posts" SET "ronin.updatedAt" = ?1 WHERE ("id" = ?2) RETURNING *',
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'pos_zgoj3xav8tpcte1s'],
      returning: true,
    },
  ]);
});

test('set single record to new json field with array', () => {
  const queries: Array<Query> = [
    {
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
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: [
        '["elaine@site.co","elaine@company.co"]',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'elaine',
      ],
      returning: true,
    },
  ]);
});

test('set single record to new json field with empty array', () => {
  const queries: Array<Query> = [
    {
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
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: ['[]', expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'elaine'],
      returning: true,
    },
  ]);
});

test('set single record to new json field with object', () => {
  const queries: Array<Query> = [
    {
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
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: [
        '{"site":"elaine@site.co","hobby":"dancer@dancing.co"}',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'elaine',
      ],
      returning: true,
    },
  ]);
});

test('set single record to new json field with empty object', () => {
  const queries: Array<Query> = [
    {
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
          slug: 'emails',
          type: 'json',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "emails" = IIF("emails" IS NULL, ?1, json_patch("emails", ?1)), "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: ['{}', expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'elaine'],
      returning: true,
    },
  ]);
});

test('set single record to new grouped string field', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "teams" SET "billing.currency" = ?1, "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'USD',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_zgoj3xav8tpcte1s',
      ],
      returning: true,
    },
  ]);
});

test('set single record to new grouped reference field', () => {
  const queries: Array<Query> = [
    {
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "teams" SET "billing.manager" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'elaine',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_zgoj3xav8tpcte1s',
      ],
      returning: true,
    },
  ]);
});

test('set single record to new grouped json field', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "teams" SET "billing.invoiceRecipients" = IIF("billing.invoiceRecipients" IS NULL, ?1, json_patch("billing.invoiceRecipients", ?1)), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        '["receipts@test.co"]',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_zgoj3xav8tpcte1s',
      ],
      returning: true,
    },
  ]);
});

test('set single record to result of nested query', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `UPDATE "teams" SET "name" = (SELECT "name" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'elaine',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_zgoj3xav8tpcte1s',
      ],
      returning: true,
    },
  ]);
});

test('create multiple records with nested sub query', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `INSERT INTO "new_accounts" SELECT * FROM "old_accounts" ORDER BY "ronin.createdAt" DESC RETURNING *`,
      params: [],
      returning: true,
    },
  ]);
});

test('create multiple records with nested sub query including additional fields', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'INSERT INTO "new_accounts" SELECT *, ?1 as "firstName" FROM "old_accounts" ORDER BY "ronin.createdAt" DESC RETURNING *',
      params: ['custom-first-name'],
      returning: true,
    },
  ]);
});

test('create multiple records with nested sub query and specific fields', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'INSERT INTO "new_accounts" SELECT "handle", ?1 as "id", ?2 as "ronin.createdAt", ?3 as "ronin.updatedAt" FROM "old_accounts" ORDER BY "ronin.createdAt" DESC RETURNING *',
      params: [
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create multiple records with nested sub query and specific meta fields', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'INSERT INTO "new_accounts" SELECT "ronin.updatedAt", ?1 as "id", ?2 as "ronin.createdAt" FROM "old_accounts" ORDER BY "ronin.createdAt" DESC RETURNING *',
      params: [
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('try to create multiple records with nested sub query including non-existent fields', () => {
  const queries: Array<Query> = [
    {
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
    },
  ];

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
    compileQueries(queries, schemas);
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
