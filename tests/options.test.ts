import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, RONIN_MODEL_SYMBOLS, Transaction } from '@/src/index';
import type { SingleRecordResult } from '@/src/types/result';

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

  expect(transaction.statements[0].statement).toStartWith(
    `INSERT INTO "accounts" ("handle", "emails", "id", "ronin.createdAt", "ronin.updatedAt") VALUES ('elaine', '["test@site.co","elaine@site.com"]'`,
  );
  expect(transaction.statements[0].params).toEqual([]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record).toMatchObject({
    handle: 'elaine',
    emails: ['test@site.co', 'elaine@site.com'],
  });
});

test('expand column names', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: {
            team: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
                get: {
                  team: {
                    with: {
                      handle: {
                        [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT}label`,
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
      slug: 'team',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'view',
      fields: [
        {
          slug: 'label',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "views" LEFT JOIN "teams" as including_team ON ("including_team"."handle" = "views"."label") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});
