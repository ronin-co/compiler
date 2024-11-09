import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

import {
  RECORD_TIMESTAMP_REGEX,
  RONIN_SCHEMA_SYMBOLS,
  RoninError,
} from '@/src/utils/helpers';
import { RECORD_ID_REGEX } from '@/src/utils/helpers';
import { SYSTEM_FIELDS } from '@/src/utils/schema';

test('create new schema', () => {
  const fields = [
    {
      slug: 'handle',
      type: 'string',
    },
    {
      slug: 'email',
      type: 'string',
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        schema: {
          to: {
            slug: 'account',
            fields,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY, "ronin.locked" BOOLEAN, "ronin.createdAt" DATETIME, "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME, "ronin.updatedBy" TEXT, "handle" TEXT, "email" TEXT)',
      params: [],
    },
    {
      statement:
        'INSERT INTO "schemas" ("slug", "fields", "pluralSlug", "name", "pluralName", "idPrefix", "identifiers.name", "identifiers.slug", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, IIF("fields" IS NULL, ?2, json_patch("fields", ?2)), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) RETURNING *',
      params: [
        'account',
        JSON.stringify([...SYSTEM_FIELDS, ...fields]),
        'accounts',
        'Account',
        'Accounts',
        'acc',
        'id',
        'id',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

// Ensure that a reasonable display name and URL slug are automatically selected for the
// schema, based on which fields are available.
test('create new schema with suitable default identifiers', () => {
  const fields = [
    {
      slug: 'name',
      type: 'string',
      required: true,
    },
    {
      slug: 'handle',
      type: 'string',
      required: true,
      unique: true
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        schema: {
          to: {
            slug: 'account',
            fields,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [];

  const statements = compileQueries(queries, schemas);

  expect(statements[1].params[6]).toEqual('name');
  expect(statements[1].params[7]).toEqual('handle');
});


// Ensure that, if the `slug` of a schema changes during an update, an `ALTER TABLE`
// statement is generated for it.
test('update existing schema (slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        schema: {
          with: {
            slug: 'account',
          },
          to: {
            slug: 'user',
          },
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
      statement: 'ALTER TABLE "accounts" RENAME TO "users"',
      params: [],
    },
    {
      statement:
        'UPDATE "schemas" SET "slug" = ?1, "pluralSlug" = ?2, "name" = ?3, "pluralName" = ?4, "idPrefix" = ?5, "ronin.updatedAt" = ?6 WHERE ("slug" = ?7) RETURNING *',
      params: [
        'user',
        'users',
        'User',
        'Users',
        'use',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'account',
      ],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a schema does not change during an update, no
// unnecessary `ALTER TABLE` statement is generated for it.
test('update existing schema (plural name)', () => {
  const queries: Array<Query> = [
    {
      set: {
        schema: {
          with: {
            slug: 'account',
          },
          to: {
            pluralName: 'Signups',
          },
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
      statement:
        'UPDATE "schemas" SET "pluralName" = ?1, "ronin.updatedAt" = ?2 WHERE ("slug" = ?3) RETURNING *',
      params: ['Signups', expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'account'],
      returning: true,
    },
  ]);
});

test('drop existing schema', () => {
  const queries: Array<Query> = [
    {
      drop: {
        schema: {
          with: {
            slug: 'account',
          },
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
      statement: 'DROP TABLE "accounts"',
      params: [],
    },
    {
      statement: 'DELETE FROM "schemas" WHERE ("slug" = ?1) RETURNING *',
      params: ['account'],
      returning: true,
    },
  ]);
});

test('query a schema that was just created', () => {
  const queries: Array<Query> = [
    {
      create: {
        schema: {
          to: {
            slug: 'account',
          },
        },
      },
    },
    {
      get: {
        account: null,
      },
    },
  ];

  const schemas: Array<Schema> = [];

  const statements = compileQueries(queries, schemas);

  expect(statements[2]).toEqual({
    statement: 'SELECT * FROM "accounts" LIMIT 1',
    params: [],
    returning: true,
  });
});

test('query a schema that was just updated', () => {
  const queries: Array<Query> = [
    {
      set: {
        schema: {
          with: {
            slug: 'account',
          },
          to: {
            slug: 'user',
          },
        },
      },
    },
    {
      get: {
        user: null,
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements[2]).toEqual({
    statement: 'SELECT * FROM "users" LIMIT 1',
    params: [],
    returning: true,
  });
});

test('query a schema that was just dropped', () => {
  const queries: Array<Query> = [
    {
      drop: {
        schema: {
          with: {
            slug: 'account',
          },
        },
      },
    },
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

  let error: Error | undefined;

  try {
    compileQueries(queries, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'No matching schema with either Slug or Plural Slug of "account" could be found.',
  );
  expect(error).toHaveProperty('code', 'SCHEMA_NOT_FOUND');
});

test('create new field', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            schema: { slug: 'account' },
            slug: 'email',
            type: 'string',
          },
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
      statement: 'ALTER TABLE "accounts" ADD COLUMN "email" TEXT',
      params: [],
    },
    {
      statement:
        'INSERT INTO "fields" ("schema", "slug", "type", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, ?4, ?5, ?6) RETURNING *',
      params: [
        'account',
        'email',
        'string',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new reference field', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            schema: { slug: 'member' },
            slug: 'account',
            type: 'reference',
            target: { slug: 'account' },
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'member',
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id")',
      params: [],
    },
    {
      statement:
        'INSERT INTO "fields" ("schema", "slug", "type", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "schemas" WHERE ("slug" = ?4) LIMIT 1), ?5, ?6, ?7) RETURNING *',
      params: [
        'member',
        'account',
        'reference',
        'account',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new reference field with actions', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            schema: { slug: 'member' },
            slug: 'account',
            type: 'reference',
            target: { slug: 'account' },
            actions: {
              onDelete: 'CASCADE',
            },
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'member',
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id") ON DELETE CASCADE',
      params: [],
    },
    {
      statement:
        'INSERT INTO "fields" ("schema", "slug", "type", "target", "actions.onDelete", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "schemas" WHERE ("slug" = ?4) LIMIT 1), ?5, ?6, ?7, ?8) RETURNING *',
      params: [
        'member',
        'account',
        'reference',
        'account',
        'CASCADE',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a field changes during a schema update, an `ALTER TABLE`
// statement is generated for it.
test('update existing field (slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            schema: { slug: 'account' },
            slug: 'email',
          },
          to: {
            slug: 'emailAddress',
          },
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
      statement: 'ALTER TABLE "accounts" RENAME COLUMN "email" TO "emailAddress"',
      params: [],
    },
    {
      statement:
        'UPDATE "fields" SET "slug" = ?1, "ronin.updatedAt" = ?2 WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?3) LIMIT 1) AND "slug" = ?4) RETURNING *',
      params: [
        'emailAddress',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'account',
        'email',
      ],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a field does not change during a schema update, no
// unnecessary `ALTER TABLE` statement is generated for it.
test('update existing field (name)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            schema: { slug: 'account' },
            slug: 'email',
          },
          to: {
            name: 'Email Address',
          },
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
      statement:
        'UPDATE "fields" SET "name" = ?1, "ronin.updatedAt" = ?2 WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?3) LIMIT 1) AND "slug" = ?4) RETURNING *',
      params: [
        'Email Address',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'account',
        'email',
      ],
      returning: true,
    },
  ]);
});

test('drop existing field', () => {
  const queries: Array<Query> = [
    {
      drop: {
        field: {
          with: {
            schema: { slug: 'account' },
            slug: 'email',
          },
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
      statement: 'ALTER TABLE "accounts" DROP COLUMN "email"',
      params: [],
    },
    {
      statement:
        'DELETE FROM "fields" WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1) AND "slug" = ?2) RETURNING *',
      params: ['account', 'email'],
      returning: true,
    },
  ]);
});

test('create new index', () => {
  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_name',
            schema: { slug: 'account' },
          },
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
      statement: 'CREATE INDEX "index_name" ON "accounts"',
      params: [],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "schema", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5) RETURNING *',
      params: [
        'index_name',
        'account',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new index with filters', () => {
  const filterInstruction = {
    email: {
      endingWith: '@site.co',
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_name',
            schema: { slug: 'account' },
            filter: filterInstruction,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: 'CREATE INDEX "index_name" ON "accounts" WHERE (("email" LIKE %?1))',
      params: ['@site.co'],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "schema", "filter", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), IIF("filter" IS NULL, ?3, json_patch("filter", ?3)), ?4, ?5, ?6) RETURNING *',
      params: [
        'index_name',
        'account',
        JSON.stringify(filterInstruction),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new unique index', () => {
  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_name',
            schema: { slug: 'account' },
            unique: true,
          },
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
      statement: 'CREATE UNIQUE INDEX "index_name" ON "accounts"',
      params: [],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "schema", "unique", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
      params: [
        'index_name',
        'account',
        1,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('drop existing index', () => {
  const queries: Array<Query> = [
    {
      drop: {
        index: {
          with: {
            slug: 'index_name',
            schema: { slug: 'account' },
          },
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
      statement: 'DROP INDEX "index_name"',
      params: [],
    },
    {
      statement:
        'DELETE FROM "indexes" WHERE ("slug" = ?1 AND "schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
      params: ['index_name', 'account'],
      returning: true,
    },
  ]);
});

test('create new trigger for creating records', () => {
  const effectQueries = [
    {
      create: {
        signup: {
          to: {
            year: 2000,
          },
        },
      },
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        trigger: {
          to: {
            slug: 'trigger_name',
            schema: { slug: 'account' },
            cause: 'afterInsert',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'signup',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_name" AFTER INSERT ON "accounts" INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4)',
      params: [
        2000,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, IIF("effects" IS NULL, ?4, json_patch("effects", ?4)), ?5, ?6, ?7) RETURNING *',
      params: [
        'trigger_name',
        'account',
        'afterInsert',
        JSON.stringify(effectQueries),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new trigger for creating records with multiple effects', () => {
  const effectQueries = [
    {
      create: {
        signup: {
          to: {
            year: 2000,
          },
        },
      },
    },
    {
      create: {
        candidate: {
          to: {
            year: 2020,
          },
        },
      },
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        trigger: {
          to: {
            slug: 'trigger_name',
            schema: { slug: 'account' },
            cause: 'afterInsert',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'candidate',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'signup',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_name" AFTER INSERT ON "accounts" BEGIN INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4); INSERT INTO "candidates" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?5, ?6, ?7, ?8) END',
      params: [
        2000,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        2020,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, IIF("effects" IS NULL, ?4, json_patch("effects", ?4)), ?5, ?6, ?7) RETURNING *',
      params: [
        'trigger_name',
        'account',
        'afterInsert',
        JSON.stringify(effectQueries),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new per-record trigger for creating records', () => {
  const effectQueries = [
    {
      create: {
        member: {
          to: {
            account: `${RONIN_SCHEMA_SYMBOLS.FIELD_NEW}createdBy`,
            role: 'owner',
            pending: false,
          },
        },
      },
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        trigger: {
          to: {
            slug: 'trigger_name',
            schema: { slug: 'team' },
            cause: 'afterInsert',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        { slug: 'account', type: 'reference', target: { slug: 'account' } },
        { slug: 'role', type: 'string' },
        { slug: 'pending', type: 'boolean' },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_name" AFTER INSERT ON "teams" FOR EACH ROW INSERT INTO "members" ("account", "role", "pending", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (NEW."createdBy", ?1, ?2, ?3, ?4, ?5)',
      params: [
        'owner',
        0,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, IIF("effects" IS NULL, ?4, json_patch("effects", ?4)), ?5, ?6, ?7) RETURNING *',
      params: [
        'trigger_name',
        'team',
        'afterInsert',
        JSON.stringify(effectQueries),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new per-record trigger for deleting records', () => {
  const effectQueries = [
    {
      drop: {
        members: {
          with: {
            account: `${RONIN_SCHEMA_SYMBOLS.FIELD_OLD}createdBy`,
          },
        },
      },
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        trigger: {
          to: {
            slug: 'trigger_name',
            schema: { slug: 'team' },
            cause: 'afterDelete',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        { slug: 'account', type: 'reference', target: { slug: 'account' } },
        { slug: 'role', type: 'string' },
        { slug: 'pending', type: 'boolean' },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_name" AFTER DELETE ON "teams" FOR EACH ROW DELETE FROM "members" WHERE ("account" = OLD."createdBy")',
      params: [],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, IIF("effects" IS NULL, ?4, json_patch("effects", ?4)), ?5, ?6, ?7) RETURNING *',
      params: [
        'trigger_name',
        'team',
        'afterDelete',
        JSON.stringify(effectQueries),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new per-record trigger with filters for creating records', () => {
  const effectQueries = [
    {
      create: {
        member: {
          to: {
            account: `${RONIN_SCHEMA_SYMBOLS.FIELD_NEW}createdBy`,
            role: 'owner',
            pending: false,
          },
        },
      },
    },
  ];

  const filterInstruction = {
    handle: {
      endingWith: '_hidden',
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        trigger: {
          to: {
            slug: 'trigger_name',
            schema: { slug: 'team' },
            cause: 'afterInsert',
            effects: effectQueries,
            filter: filterInstruction,
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
      fields: [{ slug: 'handle', type: 'string' }],
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        { slug: 'account', type: 'reference', target: { slug: 'account' } },
        { slug: 'role', type: 'string' },
        { slug: 'pending', type: 'boolean' },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_name" AFTER INSERT ON "teams" FOR EACH ROW WHEN ((NEW."handle" LIKE %?1)) INSERT INTO "members" ("account", "role", "pending", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (NEW."createdBy", ?2, ?3, ?4, ?5, ?6)',
      params: [
        '_hidden',
        'owner',
        0,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "filter", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, IIF("effects" IS NULL, ?4, json_patch("effects", ?4)), IIF("filter" IS NULL, ?5, json_patch("filter", ?5)), ?6, ?7, ?8) RETURNING *',
      params: [
        'trigger_name',
        'team',
        'afterInsert',
        JSON.stringify(effectQueries),
        JSON.stringify(filterInstruction),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('drop existing trigger', () => {
  const queries: Array<Query> = [
    {
      drop: {
        trigger: {
          with: {
            slug: 'trigger_name',
            schema: { slug: 'team' },
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: 'DROP TRIGGER "trigger_name"',
      params: [],
    },
    {
      statement:
        'DELETE FROM "triggers" WHERE ("slug" = ?1 AND "schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
      params: ['trigger_name', 'team'],
      returning: true,
    },
  ]);
});

test('try to update existing schema that does not exist', () => {
  const queries: Array<Query> = [
    {
      set: {
        schema: {
          with: {
            slug: 'account',
          },
          to: {
            slug: 'user',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'No matching schema with either Slug or Plural Slug of "account" could be found.',
  );
  expect(error).toHaveProperty('code', 'SCHEMA_NOT_FOUND');
});

test('try to update existing schema without minimum details (schema slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        schema: {
          with: {
            name: 'Accounts',
          },
          to: {
            slug: 'user',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'When updating schemas, a `slug` field must be provided in the `with` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['slug']);
});

test('try to create new field without minimum details (field slug)', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            schema: { slug: 'account' },
            slug: 'email',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
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
    'When creating fields, a `type` field must be provided in the `to` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['type']);
});

test('try to update existing field without minimum details (schema slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            slug: 'email',
          },
          to: {
            slug: 'emailAddress',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'When updating fields, a `schema.slug` field must be provided in the `with` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['schema.slug']);
});

test('try to update existing field without minimum details (field slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            schema: { slug: 'account' },
            name: 'Email Address',
          },
          to: {
            slug: 'emailAddress',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'When updating fields, a `slug` field must be provided in the `with` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['slug']);
});
