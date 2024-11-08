import { expect, test } from 'bun:test';
import { type Schema, compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';

import { RONIN_SCHEMA_SYMBOLS, RoninError } from '@/src/utils';
import { RECORD_ID_REGEX } from '@/src/utils';

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

  const query: Query = {
    create: {
      schema: {
        to: {
          slug: 'account',
          fields,
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY, "ronin.locked" BOOLEAN, "ronin.createdAt" DATETIME, "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME, "ronin.updatedBy" TEXT, "handle" TEXT, "email" TEXT)',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "schemas" ("slug", "fields", "pluralSlug", "name", "pluralName", "idPrefix", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, IIF("fields" IS NULL, ?2, json_patch("fields", ?2)), ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING *',
  );

  expect(values[0]).toBe('account');
  expect(values[1]).toBe(JSON.stringify(fields));
  expect(values[2]).toBe('accounts');
  expect(values[3]).toBe('Account');
  expect(values[4]).toBe('Accounts');
  expect(values[5]).toBe('acc');
  expect(values[6]).toMatch(RECORD_ID_REGEX);

  expect(values[7]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[8]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('update existing schema', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['ALTER TABLE "accounts" RENAME TO "users"']);

  expect(readStatement).toBe(
    'UPDATE "schemas" SET "slug" = ?1, "pluralSlug" = ?2, "name" = ?3, "pluralName" = ?4, "idPrefix" = ?5, "ronin.updatedAt" = ?6 WHERE ("slug" = ?7) RETURNING *',
  );

  expect(values[0]).toBe('user');
  expect(values[1]).toBe('users');
  expect(values[2]).toBe('User');
  expect(values[3]).toBe('Users');
  expect(values[4]).toBe('use');
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[6]).toBe('account');
});

test('drop existing schema', () => {
  const query: Query = {
    drop: {
      schema: {
        with: {
          slug: 'account',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['DROP TABLE "accounts"']);

  expect(readStatement).toBe('DELETE FROM "schemas" WHERE ("slug" = ?1) RETURNING *');

  expect(values[0]).toBe('account');
});

test('create new field', () => {
  const query: Query = {
    create: {
      field: {
        to: {
          schema: { slug: 'account' },
          slug: 'email',
          type: 'string',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['ALTER TABLE "accounts" ADD COLUMN "email" TEXT']);

  expect(readStatement).toBe(
    'INSERT INTO "fields" ("schema", "slug", "type", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, ?4, ?5, ?6) RETURNING *',
  );

  expect(values[0]).toBe('account');
  expect(values[1]).toBe('email');
  expect(values[2]).toBe('string');
  expect(values[3]).toMatch(RECORD_ID_REGEX);

  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('create new reference field', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id")',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "fields" ("schema", "slug", "type", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "schemas" WHERE ("slug" = ?4) LIMIT 1), ?5, ?6, ?7) RETURNING *',
  );

  expect(values[0]).toBe('member');
  expect(values[1]).toBe('account');
  expect(values[2]).toBe('reference');
  expect(values[3]).toBe('account');
  expect(values[4]).toMatch(RECORD_ID_REGEX);

  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[6]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('create new reference field with actions', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'ALTER TABLE "members" ADD COLUMN "account" TEXT REFERENCES accounts("id") ON DELETE CASCADE',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "fields" ("schema", "slug", "type", "target", "actions.onDelete", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "schemas" WHERE ("slug" = ?4) LIMIT 1), ?5, ?6, ?7, ?8) RETURNING *',
  );

  expect(values[0]).toBe('member');
  expect(values[1]).toBe('account');
  expect(values[2]).toBe('reference');
  expect(values[3]).toBe('account');
  expect(values[4]).toBe('CASCADE');
  expect(values[5]).toMatch(RECORD_ID_REGEX);

  expect(values[6]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[7]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('update existing field', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'ALTER TABLE "accounts" RENAME COLUMN "email" TO "emailAddress"',
  ]);

  expect(readStatement).toBe(
    'UPDATE "fields" SET "slug" = ?1, "ronin.updatedAt" = ?2 WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?3) LIMIT 1) AND "slug" = ?4) RETURNING *',
  );

  expect(values[0]).toBe('emailAddress');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('account');
  expect(values[3]).toBe('email');
});

test('drop existing field', () => {
  const query: Query = {
    drop: {
      field: {
        with: {
          schema: { slug: 'account' },
          slug: 'email',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['ALTER TABLE "accounts" DROP COLUMN "email"']);

  expect(readStatement).toBe(
    'DELETE FROM "fields" WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?1) LIMIT 1) AND "slug" = ?2) RETURNING *',
  );

  expect(values[0]).toBe('account');
  expect(values[1]).toBe('email');
});

test('create new index', () => {
  const query: Query = {
    create: {
      index: {
        to: {
          slug: 'index_name',
          schema: { slug: 'account' },
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['CREATE INDEX "index_name" ON "accounts"']);

  expect(readStatement).toBe(
    'INSERT INTO "indexes" ("slug", "schema", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5) RETURNING *',
  );

  expect(values[0]).toBe('index_name');
  expect(values[1]).toBe('account');

  expect(values[2]).toMatch(RECORD_ID_REGEX);

  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('create new index with filters', () => {
  const filterInstruction = {
    email: {
      endingWith: '@site.co',
    },
  };

  const query: Query = {
    create: {
      index: {
        to: {
          slug: 'index_name',
          schema: { slug: 'account' },
          filter: filterInstruction,
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      fields: [{ slug: 'email', type: 'string' }],
    },
  ];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE INDEX "index_name" ON "accounts" WHERE (("email" LIKE %?1))',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "indexes" ("slug", "schema", "filter", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?2, (SELECT "id" FROM "schemas" WHERE ("slug" = ?3) LIMIT 1), IIF("filter" IS NULL, ?4, json_patch("filter", ?4)), ?5, ?6, ?7) RETURNING *',
  );

  expect(values[0]).toBe('@site.co');
  expect(values[1]).toBe('index_name');
  expect(values[2]).toBe('account');
  expect(values[3]).toBe(JSON.stringify(filterInstruction));
  expect(values[4]).toMatch(RECORD_ID_REGEX);
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[6]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('create new unique index', () => {
  const query: Query = {
    create: {
      index: {
        to: {
          slug: 'index_name',
          schema: { slug: 'account' },
          unique: true,
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['CREATE UNIQUE INDEX "index_name" ON "accounts"']);

  expect(readStatement).toBe(
    'INSERT INTO "indexes" ("slug", "schema", "unique", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
  );

  expect(values[0]).toBe('index_name');
  expect(values[1]).toBe('account');
  expect(values[2]).toBe(1);

  expect(values[3]).toMatch(RECORD_ID_REGEX);

  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('drop existing index', () => {
  const query: Query = {
    drop: {
      index: {
        with: {
          slug: 'index_name',
          schema: { slug: 'account' },
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['DROP INDEX "index_name"']);

  expect(readStatement).toBe(
    'DELETE FROM "indexes" WHERE ("slug" = ?1 AND "schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
  );

  expect(values[0]).toBe('index_name');
  expect(values[1]).toBe('account');
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

  const query: Query = {
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
  };

  const schemas: Array<Schema> = [
    {
      slug: 'signup',
      fields: [{ slug: 'year', type: 'number' }],
    },
    {
      slug: 'account',
    },
  ];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TRIGGER "trigger_name" AFTER INSERT ON "accounts" INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4)',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?5, (SELECT "id" FROM "schemas" WHERE ("slug" = ?6) LIMIT 1), ?7, IIF("effects" IS NULL, ?8, json_patch("effects", ?8)), ?9, ?10, ?11) RETURNING *',
  );

  expect(values[0]).toBe(2000);
  expect(values[1]).toMatch(RECORD_ID_REGEX);
  expect(values[2]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );

  expect(values[4]).toBe('trigger_name');
  expect(values[5]).toBe('account');
  expect(values[6]).toBe('afterInsert');
  expect(values[7]).toBe(JSON.stringify(effectQueries));
  expect(values[8]).toMatch(RECORD_ID_REGEX);
  expect(values[9]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[10]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
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

  const query: Query = {
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
  };

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

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TRIGGER "trigger_name" AFTER INSERT ON "accounts" BEGIN INSERT INTO "signups" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4); INSERT INTO "candidates" ("year", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?5, ?6, ?7, ?8) END',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?9, (SELECT "id" FROM "schemas" WHERE ("slug" = ?10) LIMIT 1), ?11, IIF("effects" IS NULL, ?12, json_patch("effects", ?12)), ?13, ?14, ?15) RETURNING *',
  );

  expect(values[0]).toBe(2000);
  expect(values[1]).toMatch(RECORD_ID_REGEX);
  expect(values[2]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[4]).toBe(2020);
  expect(values[5]).toMatch(RECORD_ID_REGEX);
  expect(values[6]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[7]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[8]).toBe('trigger_name');
  expect(values[9]).toBe('account');
  expect(values[10]).toBe('afterInsert');
  expect(values[11]).toBe(JSON.stringify(effectQueries));
  expect(values[12]).toMatch(RECORD_ID_REGEX);
  expect(values[13]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[14]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
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

  const query: Query = {
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
  };

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

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TRIGGER "trigger_name" AFTER INSERT ON "teams" FOR EACH ROW INSERT INTO "members" ("account", "role", "pending", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (NEW."createdBy", ?1, ?2, ?3, ?4, ?5)',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?6, (SELECT "id" FROM "schemas" WHERE ("slug" = ?7) LIMIT 1), ?8, IIF("effects" IS NULL, ?9, json_patch("effects", ?9)), ?10, ?11, ?12) RETURNING *',
  );

  expect(values[0]).toBe('owner');
  expect(values[1]).toBe(0);
  expect(values[2]).toMatch(RECORD_ID_REGEX);
  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );

  expect(values[5]).toBe('trigger_name');
  expect(values[6]).toBe('team');
  expect(values[7]).toBe('afterInsert');
  expect(values[8]).toBe(JSON.stringify(effectQueries));
  expect(values[9]).toMatch(RECORD_ID_REGEX);
  expect(values[10]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[10]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
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

  const query: Query = {
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
  };

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

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TRIGGER "trigger_name" AFTER DELETE ON "teams" FOR EACH ROW DELETE FROM "members" WHERE ("account" = OLD."createdBy")',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1), ?3, IIF("effects" IS NULL, ?4, json_patch("effects", ?4)), ?5, ?6, ?7) RETURNING *',
  );

  expect(values[0]).toBe('trigger_name');
  expect(values[1]).toBe('team');
  expect(values[2]).toBe('afterDelete');
  expect(values[3]).toBe(JSON.stringify(effectQueries));
  expect(values[4]).toMatch(RECORD_ID_REGEX);
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[6]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
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

  const query: Query = {
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
  };

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

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TRIGGER "trigger_name" AFTER INSERT ON "teams" FOR EACH ROW WHEN ((NEW."handle" LIKE %?1)) INSERT INTO "members" ("account", "role", "pending", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (NEW."createdBy", ?2, ?3, ?4, ?5, ?6)',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "triggers" ("slug", "schema", "cause", "effects", "filter", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?7, (SELECT "id" FROM "schemas" WHERE ("slug" = ?8) LIMIT 1), ?9, IIF("effects" IS NULL, ?10, json_patch("effects", ?10)), IIF("filter" IS NULL, ?11, json_patch("filter", ?11)), ?12, ?13, ?14) RETURNING *',
  );

  expect(values[0]).toBe('_hidden');
  expect(values[1]).toBe('owner');
  expect(values[2]).toBe(0);
  expect(values[3]).toMatch(RECORD_ID_REGEX);
  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[5]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );

  expect(values[6]).toBe('trigger_name');
  expect(values[7]).toBe('team');
  expect(values[8]).toBe('afterInsert');
  expect(values[9]).toBe(JSON.stringify(effectQueries));
  expect(values[10]).toBe(JSON.stringify(filterInstruction));
  expect(values[11]).toMatch(RECORD_ID_REGEX);
  expect(values[12]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[13]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('drop existing trigger', () => {
  const query: Query = {
    drop: {
      trigger: {
        with: {
          slug: 'trigger_name',
          schema: { slug: 'team' },
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['DROP TRIGGER "trigger_name"']);

  expect(readStatement).toBe(
    'DELETE FROM "triggers" WHERE ("slug" = ?1 AND "schema" = (SELECT "id" FROM "schemas" WHERE ("slug" = ?2) LIMIT 1)) RETURNING *',
  );

  expect(values[0]).toBe('trigger_name');
  expect(values[1]).toBe('team');
});

test('try to update existing schema without minimum details (schema slug)', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueryInput(query, schemas);
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
  const query: Query = {
    create: {
      field: {
        to: {
          schema: { slug: 'account' },
          slug: 'email',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueryInput(query, schemas);
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
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueryInput(query, schemas);
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
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [];

  let error: Error | undefined;

  try {
    compileQueryInput(query, schemas);
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
