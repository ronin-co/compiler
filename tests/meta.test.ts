import { expect, test } from 'bun:test';
import { compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { RoninError } from '@/src/utils';
import { RECORD_ID_REGEX } from '@/src/utils';

test('create new schema', () => {
  const query: Query = {
    create: {
      schema: {
        to: {
          pluralSlug: 'accounts',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual([
    'CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY, "ronin.locked" BOOLEAN, "ronin.createdAt" DATETIME, "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME, "ronin.updatedBy" TEXT)',
  ]);

  expect(readStatement).toBe(
    'INSERT INTO "schemas" ("pluralSlug", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, ?2, ?3, ?4) RETURNING *',
  );

  expect(values[0]).toBe('accounts');

  expect(values[1]).toMatch(RECORD_ID_REGEX);

  expect(values[2]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('update existing schema', () => {
  const query: Query = {
    set: {
      schema: {
        with: {
          pluralSlug: 'accounts',
        },
        to: {
          pluralSlug: 'users',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['ALTER TABLE "accounts" RENAME TO "users"']);

  expect(readStatement).toBe(
    'UPDATE "schemas" SET "pluralSlug" = ?1, "ronin.updatedAt" = ?2 WHERE ("pluralSlug" = ?3) RETURNING *',
  );

  expect(values[0]).toBe('users');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('accounts');
});

test('drop existing schema', () => {
  const query: Query = {
    drop: {
      schema: {
        with: {
          pluralSlug: 'accounts',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['DROP TABLE "accounts"']);

  expect(readStatement).toBe(
    'DELETE FROM "schemas" WHERE ("pluralSlug" = ?1) RETURNING *',
  );

  expect(values[0]).toBe('accounts');
});

test('create new field', () => {
  const query: Query = {
    create: {
      field: {
        to: {
          schema: { pluralSlug: 'accounts' },
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
    'INSERT INTO "fields" ("schema", "slug", "type", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?1) LIMIT 1), ?2, ?3, ?4, ?5, ?6) RETURNING *',
  );

  expect(values[0]).toBe('accounts');
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
          schema: { pluralSlug: 'members' },
          slug: 'account',
          type: 'reference',
          target: { pluralSlug: 'accounts' },
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
    'INSERT INTO "fields" ("schema", "slug", "type", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?4) LIMIT 1), ?5, ?6, ?7) RETURNING *',
  );

  expect(values[0]).toBe('members');
  expect(values[1]).toBe('account');
  expect(values[2]).toBe('reference');
  expect(values[3]).toBe('accounts');
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
          schema: { pluralSlug: 'members' },
          slug: 'account',
          type: 'reference',
          target: { pluralSlug: 'accounts' },
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
    'INSERT INTO "fields" ("schema", "slug", "type", "target", "actions.onDelete", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ((SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?1) LIMIT 1), ?2, ?3, (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?4) LIMIT 1), ?5, ?6, ?7, ?8) RETURNING *',
  );

  expect(values[0]).toBe('members');
  expect(values[1]).toBe('account');
  expect(values[2]).toBe('reference');
  expect(values[3]).toBe('accounts');
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
          schema: { pluralSlug: 'accounts' },
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
    'UPDATE "fields" SET "slug" = ?1, "ronin.updatedAt" = ?2 WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?3) LIMIT 1) AND "slug" = ?4) RETURNING *',
  );

  expect(values[0]).toBe('emailAddress');
  expect(values[1]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[2]).toBe('accounts');
  expect(values[3]).toBe('email');
});

test('drop existing field', () => {
  const query: Query = {
    drop: {
      field: {
        with: {
          schema: { pluralSlug: 'accounts' },
          slug: 'email',
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['ALTER TABLE "accounts" DROP COLUMN "email"']);

  expect(readStatement).toBe(
    'DELETE FROM "fields" WHERE ("schema" = (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?1) LIMIT 1) AND "slug" = ?2) RETURNING *',
  );

  expect(values[0]).toBe('accounts');
  expect(values[1]).toBe('email');
});

test('create new index', () => {
  const query: Query = {
    create: {
      index: {
        to: {
          slug: 'index_name',
          schema: { pluralSlug: 'accounts' },
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['CREATE INDEX "index_name" ON "accounts"']);

  expect(readStatement).toBe(
    'INSERT INTO "indexes" ("slug", "schema", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?2) LIMIT 1), ?3, ?4, ?5) RETURNING *',
  );

  expect(values[0]).toBe('index_name');
  expect(values[1]).toBe('accounts');

  expect(values[2]).toMatch(RECORD_ID_REGEX);

  expect(values[3]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
  expect(values[4]).toSatisfy(
    (value) => typeof value === 'string' && typeof Date.parse(value) === 'number',
  );
});

test('create new unique index', () => {
  const query: Query = {
    create: {
      index: {
        to: {
          slug: 'index_name',
          schema: { pluralSlug: 'accounts' },
          unique: true,
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['CREATE UNIQUE INDEX "index_name" ON "accounts"']);

  expect(readStatement).toBe(
    'INSERT INTO "indexes" ("slug", "schema", "unique", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?2) LIMIT 1), ?3, ?4, ?5, ?6) RETURNING *',
  );

  expect(values[0]).toBe('index_name');
  expect(values[1]).toBe('accounts');
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
          schema: { pluralSlug: 'accounts' },
        },
      },
    },
  };

  const schemas: Array<Schema> = [];

  const { writeStatements, readStatement, values } = compileQueryInput(query, schemas);

  expect(writeStatements).toEqual(['DROP INDEX "index_name"']);

  expect(readStatement).toBe(
    'DELETE FROM "indexes" WHERE ("slug" = ?1 AND "schema" = (SELECT "id" FROM "schemas" WHERE ("pluralSlug" = ?2) LIMIT 1)) RETURNING *',
  );

  expect(values[0]).toBe('index_name');
  expect(values[1]).toBe('accounts');
});

test('try to update existing schema without minimum details (schema slug)', () => {
  const query: Query = {
    set: {
      schema: {
        with: {
          name: 'Accounts',
        },
        to: {
          pluralSlug: 'users',
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
    'When updating schemas, a `pluralSlug` field must be provided in the `with` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['pluralSlug']);
});

test('try to create new field without minimum details (field slug)', () => {
  const query: Query = {
    create: {
      field: {
        to: {
          schema: { pluralSlug: 'accounts' },
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
    'When updating fields, a `schema.pluralSlug` field must be provided in the `with` instruction.',
  );
  expect(error).toHaveProperty('code', 'MISSING_FIELD');
  expect(error).toHaveProperty('fields', ['schema.pluralSlug']);
});

test('try to update existing field without minimum details (field slug)', () => {
  const query: Query = {
    set: {
      field: {
        with: {
          schema: { pluralSlug: 'accounts' },
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
