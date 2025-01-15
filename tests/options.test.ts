import { expect, test } from 'bun:test';
import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import { type Model, type ModelField, type Query, Transaction } from '@/src/index';
import { getSystemFields } from '@/src/model';
import type { SingleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS } from '@/src/utils/helpers';

test('inline statement parameters', async () => {
  const queries: Array<Query> = [
    {
      add: {
        account: {
          to: {
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

  const transaction = new Transaction(queries, {
    models,
    inlineParams: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `INSERT INTO "accounts" ("handle", "emails") VALUES ('elaine', json('["test@site.co","elaine@site.com"]')) RETURNING *`,
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
  const newField: ModelField = {
    slug: 'activeAt',
    name: 'Active At',
    type: 'date',
    defaultValue: {
      [QUERY_SYMBOLS.EXPRESSION]: `strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'`,
    },
  };

  const queries: Array<Query> = [
    {
      create: {
        model: {
          slug: 'account',
          fields: [newField],
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
      statement: `CREATE TABLE "accounts" ("id" TEXT PRIMARY KEY DEFAULT ('acc_' || lower(substr(hex(randomblob(12)), 1, 16))), "ronin.locked" BOOLEAN, "ronin.createdAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.createdBy" TEXT, "ronin.updatedAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'), "ronin.updatedBy" TEXT, "activeAt" DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z'))`,
      params: [],
    },
    {
      statement: `INSERT INTO "ronin_schema" ("slug", "fields", "id", "pluralSlug", "name", "pluralName", "idPrefix", "table", "identifiers.name", "identifiers.slug") VALUES ('account', json('{"id":{"name":"ID","type":"string","defaultValue":{"__RONIN_EXPRESSION":"''acc_'' || lower(substr(hex(randomblob(12)), 1, 16))"}},"ronin.locked":{"name":"RONIN - Locked","type":"boolean"},"ronin.createdAt":{"name":"RONIN - Created At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}},"ronin.createdBy":{"name":"RONIN - Created By","type":"string"},"ronin.updatedAt":{"name":"RONIN - Updated At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}},"ronin.updatedBy":{"name":"RONIN - Updated By","type":"string"},"activeAt":{"name":"Active At","type":"date","defaultValue":{"__RONIN_EXPRESSION":"strftime(''%Y-%m-%dT%H:%M:%f'', ''now'') || ''Z''"}}}'), 'mod_1f052f8432bc861b', 'accounts', 'Account', 'Accounts', 'acc', 'accounts', 'id', 'id') RETURNING *`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    fields: [...getSystemFields('acc'), newField],
  });
});

test('expand column names', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          including: {
            account: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  account: {
                    with: {
                      id: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}account`,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "members"."id", "members"."ronin.locked", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."id", "including_account"."ronin.locked", "including_account"."ronin.createdAt", "including_account"."ronin.createdBy", "including_account"."ronin.updatedAt", "including_account"."ronin.updatedBy" FROM "members" LEFT JOIN "accounts" as including_account ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    account: {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
    },
  });
});
