import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import { getSystemFields } from '@/src/model';
import type { SingleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS } from '@/src/utils/helpers';

test('inline statement parameters', async () => {
  const queries: Array<Query> = [
    {
      add: {
        account: {
          with: {
            handle: 'elaine',
            emails: ['test@site.co', 'elaine@site.com'],
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
        emails: {
          type: 'json',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `INSERT INTO "accounts" ("handle", "emails") VALUES ('elaine', json('["test@site.co","elaine@site.com"]')) RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle", "emails"`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'elaine',
    emails: ['test@site.co', 'elaine@site.com'],
  });
});

test('inline statement parameters containing serialized expression', async () => {
  const newField = {
    name: 'Active At',
    type: 'date' as const,
    defaultValue: {
      [QUERY_SYMBOLS.EXPRESSION]: `strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'`,
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: {
          slug: 'account',
          fields: { activeAt: newField },
          // Ensure that the ID in the asserted output stays stable.
          id: 'mod_1f052f8432bc861b',
        },
      },
    },
  ];

  const models: Array<Model> = [];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY DEFAULT ('acc_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "activeAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'))`,
      params: [],
    },
    {
      statement: `INSERT INTO "ronin_schema" ("slug", "fields", "id", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug") VALUES ('account', json('{"id":{"name":"ID","type":"string","defaultValue":{"__RONIN_EXPRESSION":"''acc_'' || lower(substr(hex(randomblob(12)), 1, 16))"}},"ronin.createdAt":{"name":"RONIN - Created At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}},"ronin.createdBy":{"name":"RONIN - Created By","type":"string"},"ronin.updatedAt":{"name":"RONIN - Updated At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}},"ronin.updatedBy":{"name":"RONIN - Updated By","type":"string"},"activeAt":{"name":"Active At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}}}'), 'mod_1f052f8432bc861b', 'accounts', 'Account', 'Accounts', 'acc', 'accounts', 'id', 'id') RETURNING "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "pluralName", "slug", "pluralSlug", "idPrefix", "table", "identifiers.name", "identifiers.slug", "fields", "indexes", "triggers", "presets"`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    fields: { ...getSystemFields('acc'), activeAt: newField },
  });
});

test('inline statement parameters containing boolean', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            pending: false,
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'member',
      fields: {
        pending: {
          type: 'boolean',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "pending" FROM "members" WHERE "pending" = false LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    pending: false,
  });
});

// Ensure that default fields are not repeated if they are already present.
test('provide models containing default fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: 'elaine',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        ...getSystemFields('acc'),
        handle: {
          type: 'string',
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "handle" FROM "accounts" WHERE "handle" = 'elaine' LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'elaine',
  });
});

// Ensure that default presets are not repeated if they are already present.
test('provide models containing default presets', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          using: ['account'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: {
        handle: {
          type: 'string',
        },
      },
    },
    {
      slug: 'member',
      fields: {
        account: {
          type: 'link',
          target: 'account',
        },
      },
      presets: {
        account: {
          instructions: {
            with: {
              account: {
                handle: 'elaine',
              },
            },
          },
        },
      },
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "id", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account" FROM "members" WHERE "account" = (SELECT "id" FROM "accounts" WHERE "handle" = 'elaine' LIMIT 1) LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    account: 'acc_39h8fhe98hefah8j',
  });
});
