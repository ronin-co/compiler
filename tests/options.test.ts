import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
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
      statement: `SELECT *, "including_account"."id" as "including_account.id", "including_account"."ronin.locked" as "including_account.ronin.locked", "including_account"."ronin.createdAt" as "including_account.ronin.createdAt", "including_account"."ronin.createdBy" as "including_account.ronin.createdBy", "including_account"."ronin.updatedAt" as "including_account.ronin.updatedAt", "including_account"."ronin.updatedBy" as "including_account.ronin.updatedBy" FROM "members" LEFT JOIN "accounts" as including_account ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});
