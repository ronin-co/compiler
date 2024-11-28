import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

test('inline statement values', () => {
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
});
