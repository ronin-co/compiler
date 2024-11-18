import { expect, test } from 'bun:test';
import { type Model, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

import {
  RECORD_TIMESTAMP_REGEX,
  RONIN_MODEL_SYMBOLS,
  RoninError,
} from '@/src/utils/helpers';
import { RECORD_ID_REGEX } from '@/src/utils/helpers';
import { SYSTEM_FIELDS } from '@/src/utils/model';

test('create new model', () => {
  const fields = [
    {
      slug: 'handle',
      type: 'string',
    },
    {
      slug: 'email',
      type: 'string',
      required: true,
      unique: true,
      check: {
        [RONIN_MODEL_SYMBOLS.EXPRESSION]: `length(${RONIN_MODEL_SYMBOLS.FIELD}handle) >= 3`,
      },
      collation: 'NOCASE',
    },
    {
      slug: 'position',
      type: 'number',
      increment: true,
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        model: {
          to: {
            slug: 'account',
            fields,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY, "ronin.locked" BOOLEAN, "ronin.createdAt" DATETIME, "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME, "ronin.updatedBy" TEXT, "handle" TEXT, "email" TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK (length("handle") >= 3), "position" INTEGER AUTOINCREMENT)',
      params: [],
    },
    {
      statement:
        'INSERT INTO "models" ("slug", "fields", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) RETURNING *',
      params: [
        'account',
        JSON.stringify([...SYSTEM_FIELDS, ...fields]),
        'accounts',
        'Account',
        'Accounts',
        'acc',
        'accounts',
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
// model, based on which fields are available.
test('create new model with suitable default identifiers', () => {
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
      unique: true,
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        model: {
          to: {
            slug: 'account',
            fields,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [];

  const statements = compileQueries(queries, models);

  expect(statements[1].params[7]).toEqual('name');
  expect(statements[1].params[8]).toEqual('handle');
});

// Ensure that, if the `slug` of a model changes during an update, an `ALTER TABLE`
// statement is generated for it.
test('update existing model (slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        model: {
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

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: 'ALTER TABLE "accounts" RENAME TO "users"',
      params: [],
    },
    {
      statement:
        'UPDATE "models" SET "slug" = ?1, "pluralSlug" = ?2, "name" = ?3, "pluralName" = ?4, "idPrefix" = ?5, "table" = ?6, "ronin.updatedAt" = ?7 WHERE ("slug" = ?8) RETURNING *',
      params: [
        'user',
        'users',
        'User',
        'Users',
        'use',
        'users',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'account',
      ],
      returning: true,
    },
  ]);
});

// Ensure that, if the `slug` of a model does not change during an update, no
// unnecessary `ALTER TABLE` statement is generated for it.
test('update existing model (plural name)', () => {
  const queries: Array<Query> = [
    {
      set: {
        model: {
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

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'UPDATE "models" SET "pluralName" = ?1, "ronin.updatedAt" = ?2 WHERE ("slug" = ?3) RETURNING *',
      params: ['Signups', expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'account'],
      returning: true,
    },
  ]);
});

test('drop existing model', () => {
  const queries: Array<Query> = [
    {
      drop: {
        model: {
          with: {
            slug: 'account',
          },
        },
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
      statement: 'DROP TABLE "accounts"',
      params: [],
    },
    {
      statement: 'DELETE FROM "models" WHERE ("slug" = ?1) RETURNING *',
      params: ['account'],
      returning: true,
    },
  ]);
});

test('query a model that was just created', () => {
  const queries: Array<Query> = [
    {
      create: {
        model: {
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

  const models: Array<Model> = [];

  const statements = compileQueries(queries, models);

  expect(statements[2]).toEqual({
    statement: 'SELECT * FROM "accounts" LIMIT 1',
    params: [],
    returning: true,
  });
});

test('query a model that was just updated', () => {
  const queries: Array<Query> = [
    {
      set: {
        model: {
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

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements[2]).toEqual({
    statement: 'SELECT * FROM "users" LIMIT 1',
    params: [],
    returning: true,
  });
});

test('query a model that was just dropped', () => {
  const queries: Array<Query> = [
    {
      drop: {
        model: {
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

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'No matching model with either Slug or Plural Slug of "account" could be found.',
  );
  expect(error).toHaveProperty('code', 'MODEL_NOT_FOUND');
});

test('create new field', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            model: { slug: 'account' },
            slug: 'email',
            type: 'string',
          },
        },
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
      statement: 'ALTER TABLE "accounts" ADD COLUMN "email" TEXT',
      params: [],
    },
    {
      statement:
        'INSERT INTO "fields" ("model", "slug", "type", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "models" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, ?4, ?5, ?6) RETURNING *',
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

test('create new link field', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            model: { slug: 'member' },
            slug: 'account',
            type: 'link',
            target: { slug: 'account' },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'member',
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id")',
      params: [],
    },
    {
      statement:
        'INSERT INTO "fields" ("model", "slug", "type", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "models" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "models" WHERE ("slug" = ?4) LIMIT 1), ?5, ?6, ?7) RETURNING *',
      params: [
        'member',
        'account',
        'link',
        'account',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new link field with actions', () => {
  const queries: Array<Query> = [
    {
      create: {
        field: {
          to: {
            model: { slug: 'member' },
            slug: 'account',
            type: 'link',
            target: { slug: 'account' },
            actions: {
              onDelete: 'CASCADE',
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'member',
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id") ON DELETE CASCADE',
      params: [],
    },
    {
      statement:
        'INSERT INTO "fields" ("model", "slug", "type", "target", "actions.onDelete", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "models" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "models" WHERE ("slug" = ?4) LIMIT 1), ?5, ?6, ?7, ?8) RETURNING *',
      params: [
        'member',
        'account',
        'link',
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

// Ensure that, if the `slug` of a field changes during a model update, an `ALTER TABLE`
// statement is generated for it.
test('update existing field (slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            model: { slug: 'account' },
            slug: 'email',
          },
          to: {
            slug: 'emailAddress',
          },
        },
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
      statement: 'ALTER TABLE "accounts" RENAME COLUMN "email" TO "emailAddress"',
      params: [],
    },
    {
      statement:
        'UPDATE "fields" SET "slug" = ?1, "ronin.updatedAt" = ?2 WHERE ("model" = (SELECT "id" FROM "models" WHERE ("slug" = ?3) LIMIT 1) AND "slug" = ?4) RETURNING *',
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

// Ensure that, if the `slug` of a field does not change during a model update, no
// unnecessary `ALTER TABLE` statement is generated for it.
test('update existing field (name)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            model: { slug: 'account' },
            slug: 'email',
          },
          to: {
            name: 'Email Address',
          },
        },
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
      statement:
        'UPDATE "fields" SET "name" = ?1, "ronin.updatedAt" = ?2 WHERE ("model" = (SELECT "id" FROM "models" WHERE ("slug" = ?3) LIMIT 1) AND "slug" = ?4) RETURNING *',
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
            model: { slug: 'account' },
            slug: 'email',
          },
        },
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
      statement: 'ALTER TABLE "accounts" DROP COLUMN "email"',
      params: [],
    },
    {
      statement:
        'DELETE FROM "fields" WHERE ("model" = (SELECT "id" FROM "models" WHERE ("slug" = ?1) LIMIT 1) AND "slug" = ?2) RETURNING *',
      params: ['account', 'email'],
      returning: true,
    },
  ]);
});

test('create new index', () => {
  const fields = [
    {
      slug: 'email',
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_slug',
            model: { slug: 'account' },
            fields,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: 'CREATE INDEX "index_slug" ON "accounts" ("email")',
      params: [],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "model", "fields", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
      params: [
        'index_slug',
        'account',
        JSON.stringify(fields),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new index with filter', () => {
  const fields = [
    {
      slug: 'email',
    },
  ];

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
            slug: 'index_slug',
            model: { slug: 'account' },
            fields,
            filter: filterInstruction,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE INDEX "index_slug" ON "accounts" ("email") WHERE (("email" LIKE %?1))',
      params: ['@site.co'],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "model", "fields", "filter", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7) RETURNING *',
      params: [
        'index_slug',
        'account',
        JSON.stringify(fields),
        JSON.stringify(filterInstruction),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new index with field expressions', () => {
  const fields = [
    {
      expression: `LOWER(${RONIN_MODEL_SYMBOLS.FIELD}firstName || ' ' || ${RONIN_MODEL_SYMBOLS.FIELD}lastName)`,
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_slug',
            model: { slug: 'account' },
            fields,
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
          slug: 'firstName',
          type: 'string',
        },
        {
          slug: 'lastName',
          type: 'string',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: `CREATE INDEX "index_slug" ON "accounts" (LOWER("firstName" || ' ' || "lastName"))`,
      params: [],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "model", "fields", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
      params: [
        'index_slug',
        'account',
        JSON.stringify(fields),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new index with ordered and collated fields', () => {
  const fields = [
    {
      slug: 'email',
      order: 'ASC',
      collation: 'NOCASE',
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_slug',
            model: { slug: 'account' },
            fields,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: 'CREATE INDEX "index_slug" ON "accounts" ("email" COLLATE NOCASE ASC)',
      params: [],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "model", "fields", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
      params: [
        'index_slug',
        'account',
        JSON.stringify(fields),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new unique index', () => {
  const fields = [
    {
      slug: 'email',
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        index: {
          to: {
            slug: 'index_slug',
            model: { slug: 'account' },
            fields,
            unique: true,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: 'CREATE UNIQUE INDEX "index_slug" ON "accounts" ("email")',
      params: [],
    },
    {
      statement:
        'INSERT INTO "indexes" ("slug", "model", "fields", "unique", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7) RETURNING *',
      params: [
        'index_slug',
        'account',
        JSON.stringify(fields),
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
            slug: 'index_slug',
            model: { slug: 'account' },
          },
        },
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
      statement: 'DROP INDEX "index_slug"',
      params: [],
    },
    {
      statement:
        'DELETE FROM "indexes" WHERE ("slug" = ?1 AND "model" = (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
      params: ['index_slug', 'account'],
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
            slug: 'trigger_slug',
            model: { slug: 'account' },
            when: 'AFTER',
            action: 'INSERT',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'signup',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'account',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_slug" AFTER INSERT ON "accounts" INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4)',
      params: [
        2000,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "model", "when", "action", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7, ?8) RETURNING *',
      params: [
        'trigger_slug',
        'account',
        'AFTER',
        'INSERT',
        JSON.stringify(effectQueries),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('create new trigger for creating records with targeted fields', () => {
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

  const fields = [
    {
      slug: 'email',
    },
  ];

  const queries: Array<Query> = [
    {
      create: {
        trigger: {
          to: {
            slug: 'trigger_slug',
            model: { slug: 'account' },
            when: 'AFTER',
            action: 'UPDATE',
            effects: effectQueries,
            fields,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'signup',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_slug" AFTER UPDATE OF ("email") ON "accounts" INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4)',
      params: [
        2000,
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "model", "when", "action", "effects", "fields", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING *',
      params: [
        'trigger_slug',
        'account',
        'AFTER',
        'UPDATE',
        JSON.stringify(effectQueries),
        JSON.stringify(fields),
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
            slug: 'trigger_slug',
            model: { slug: 'account' },
            when: 'AFTER',
            action: 'INSERT',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
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

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_slug" AFTER INSERT ON "accounts" BEGIN INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4); INSERT INTO "candidates" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?5, ?6, ?7, ?8) END',
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
        'INSERT INTO "triggers" ("slug", "model", "when", "action", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7, ?8) RETURNING *',
      params: [
        'trigger_slug',
        'account',
        'AFTER',
        'INSERT',
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
            account: {
              [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT_NEW}createdBy`,
            },
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
            slug: 'trigger_slug',
            model: { slug: 'team' },
            when: 'AFTER',
            action: 'INSERT',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'createdBy',
          type: 'string',
        },
      ],
    },
    {
      slug: 'member',
      fields: [
        { slug: 'account', type: 'string' },
        { slug: 'role', type: 'string' },
        { slug: 'pending', type: 'boolean' },
      ],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_slug" AFTER INSERT ON "teams" FOR EACH ROW INSERT INTO "members" ("account", "role", "pending", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (NEW."createdBy", ?1, ?2, ?3, ?4, ?5)',
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
        'INSERT INTO "triggers" ("slug", "model", "when", "action", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7, ?8) RETURNING *',
      params: [
        'trigger_slug',
        'team',
        'AFTER',
        'INSERT',
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
            account: {
              [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT_OLD}createdBy`,
            },
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
            slug: 'trigger_slug',
            model: { slug: 'team' },
            when: 'AFTER',
            action: 'DELETE',
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'createdBy',
          type: 'string',
        },
      ],
    },
    {
      slug: 'member',
      fields: [
        { slug: 'account', type: 'string' },
        { slug: 'role', type: 'string' },
        { slug: 'pending', type: 'boolean' },
      ],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_slug" AFTER DELETE ON "teams" FOR EACH ROW DELETE FROM "members" WHERE ("account" = OLD."createdBy")',
      params: [],
    },
    {
      statement:
        'INSERT INTO "triggers" ("slug", "model", "when", "action", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7, ?8) RETURNING *',
      params: [
        'trigger_slug',
        'team',
        'AFTER',
        'DELETE',
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
            account: {
              [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT_NEW}createdBy`,
            },
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
            slug: 'trigger_slug',
            model: { slug: 'team' },
            when: 'AFTER',
            action: 'INSERT',
            effects: effectQueries,
            filter: filterInstruction,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: [
        { slug: 'handle', type: 'string' },
        { slug: 'createdBy', type: 'string' },
      ],
    },
    {
      slug: 'member',
      fields: [
        { slug: 'account', type: 'string' },
        { slug: 'role', type: 'string' },
        { slug: 'pending', type: 'boolean' },
      ],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'CREATE TRIGGER "trigger_slug" AFTER INSERT ON "teams" FOR EACH ROW WHEN ((NEW."handle" LIKE %?1)) INSERT INTO "members" ("account", "role", "pending", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (NEW."createdBy", ?2, ?3, ?4, ?5, ?6)',
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
        'INSERT INTO "triggers" ("slug", "model", "when", "action", "effects", "filter", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING *',
      params: [
        'trigger_slug',
        'team',
        'AFTER',
        'INSERT',
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
            slug: 'trigger_slug',
            model: { slug: 'team' },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: 'DROP TRIGGER "trigger_slug"',
      params: [],
    },
    {
      statement:
        'DELETE FROM "triggers" WHERE ("slug" = ?1 AND "model" = (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
      params: ['trigger_slug', 'team'],
      returning: true,
    },
  ]);
});

test('create new preset', () => {
  const instructions = {
    with: {
      email: {
        endingWith: '@company.co',
      },
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        preset: {
          to: {
            slug: 'company_employees',
            model: { slug: 'account' },
            instructions,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement:
        'INSERT INTO "presets" ("slug", "model", "instructions", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
      params: [
        'company_employees',
        'account',
        JSON.stringify(instructions),
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('drop existing preset', () => {
  const queries: Array<Query> = [
    {
      drop: {
        preset: {
          with: {
            slug: 'company_employees',
            model: { slug: 'account' },
          },
        },
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
      statement:
        'DELETE FROM "presets" WHERE ("slug" = ?1 AND "model" = (SELECT "id" FROM "models" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
      params: ['company_employees', 'account'],
      returning: true,
    },
  ]);
});

test('try to update existing model that does not exist', () => {
  const queries: Array<Query> = [
    {
      set: {
        model: {
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

  const models: Array<Model> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'No matching model with either Slug or Plural Slug of "account" could be found.',
  );
  expect(error).toHaveProperty('code', 'MODEL_NOT_FOUND');
});

test('try to update existing model without minimum details (model slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        model: {
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

  const models: Array<Model> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'When updating models, a `slug` field must be provided in the `with` instruction.',
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
            model: { slug: 'account' },
            slug: 'email',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
  ];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
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

test('try to update existing field without minimum details (model slug)', () => {
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

  const models: Array<Model> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'When updating fields, a `model.slug` field must be provided in the `with` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['model.slug']);
});

test('try to update existing field without minimum details (field slug)', () => {
  const queries: Array<Query> = [
    {
      set: {
        field: {
          with: {
            model: { slug: 'account' },
            name: 'Email Address',
          },
          to: {
            slug: 'emailAddress',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
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

test('try to create new trigger with targeted fields and wrong action', () => {
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
            slug: 'trigger_slug',
            model: { slug: 'account' },
            when: 'AFTER',
            action: 'INSERT',
            fields: [{ slug: 'email' }],
            effects: effectQueries,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'signup',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'account',
    },
  ];

  let error: Error | undefined;

  try {
    compileQueries(queries, models);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'When creating triggers, targeting specific fields requires the `UPDATE` action.',
  );
  expect(error).toHaveProperty('code', 'INVALID_MODEL_VALUE');
  expect(error).toHaveProperty('fields', ['action']);
});
