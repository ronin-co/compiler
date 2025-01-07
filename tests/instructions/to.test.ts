import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

import { RECORD_TIMESTAMP_REGEX, queryEphemeralDatabase } from '@/fixtures/utils';
import type { MultipleRecordResult, SingleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS, RoninError } from '@/src/utils/helpers';

test('set single record to new string field', async () => {
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

  const models: Array<Model> = [
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "handle" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("handle" = ?2) RETURNING *`,
      params: ['mia', 'elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('mia');
});

test('set single record to new string field with expression referencing fields', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            handle: 'elaine',
          },
          to: {
            handle: {
              [QUERY_SYMBOLS.EXPRESSION]: `LOWER(${QUERY_SYMBOLS.FIELD}firstName || ${QUERY_SYMBOLS.FIELD}lastName)`,
            },
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "handle" = LOWER("firstName" || "lastName"), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("handle" = ?1) RETURNING *`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('elainejones');
});

test('set single record to new one-cardinality link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        member: {
          with: {
            id: 'mem_39h8fhe98hefah9j',
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

  const models: Array<Model> = [
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
          type: 'link',
          target: 'account',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "members" SET "account" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?2) RETURNING *`,
      params: ['elaine', 'mem_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const [[targetRecord]] = await queryEphemeralDatabase(
    models,
    [
      {
        statement: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
        params: [],
      },
    ],
    false,
  );

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.account).toBe(targetRecord.id);
});

test('set single record to new many-cardinality link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            id: 'acc_39h8fhe98hefah8j',
          },
          to: {
            followers: [{ handle: 'david' }],
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
          slug: 'followers',
          type: 'link',
          target: 'account',
          kind: 'many',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'DELETE FROM "ronin_link_account_followers" WHERE ("source" = ?1)',
      params: ['acc_39h8fhe98hefah8j'],
    },
    {
      statement:
        'INSERT INTO "ronin_link_account_followers" ("source", "target") VALUES (?1, (SELECT "id" FROM "accounts" WHERE ("handle" = ?2) LIMIT 1))',
      params: ['acc_39h8fhe98hefah8j', 'david'],
    },
    {
      statement: `UPDATE "accounts" SET "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?1) RETURNING *`,
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field (add)', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            id: 'acc_39h8fhe98hefah8j',
          },
          to: {
            followers: {
              containing: [{ handle: 'david' }],
            },
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
          slug: 'followers',
          type: 'link',
          target: 'account',
          kind: 'many',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "ronin_link_account_followers" ("source", "target") VALUES (?1, (SELECT "id" FROM "accounts" WHERE ("handle" = ?2) LIMIT 1))',
      params: ['acc_39h8fhe98hefah8j', 'david'],
    },
    {
      statement: `UPDATE "accounts" SET "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?1) RETURNING *`,
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field (remove)', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            id: 'acc_39h8fhe98hefah8j',
          },
          to: {
            followers: {
              notContaining: [{ handle: 'david' }],
            },
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
          slug: 'followers',
          type: 'link',
          target: 'account',
          kind: 'many',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'DELETE FROM "ronin_link_account_followers" WHERE ("source" = ?1 AND "target" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?2) LIMIT 1))',
      params: ['acc_39h8fhe98hefah8j', 'david'],
    },
    {
      statement: `UPDATE "accounts" SET "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?1) RETURNING *`,
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new json field with array', async () => {
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "emails" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("handle" = ?2) RETURNING *`,
      params: ['["elaine@site.co","elaine@company.co"]', 'elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.emails).toEqual(['elaine@site.co', 'elaine@company.co']);
});

test('set single record to new json field with object', async () => {
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "accounts" SET "emails" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("handle" = ?2) RETURNING *`,
      params: ['{"site":"elaine@site.co","hobby":"dancer@dancing.co"}', 'elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.emails).toEqual({
    site: 'elaine@site.co',
    hobby: 'dancer@dancing.co',
  });
});

test('set single record to new nested string field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah8j',
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

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'billing.currency',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "teams" SET "billing.currency" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?2) RETURNING *`,
      params: ['USD', 'tea_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect((result.record?.billing as { currency: string })?.currency).toBe('USD');
});

test('set single record to new nested link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah8j',
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

  const models: Array<Model> = [
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
          slug: 'billing.manager',
          type: 'link',
          target: 'account',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "teams" SET "billing.manager" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?2) RETURNING *`,
      params: ['elaine', 'tea_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const [[targetRecord]] = await queryEphemeralDatabase(
    models,
    [
      {
        statement: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
        params: [],
      },
    ],
    false,
  );

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect((result.record?.billing as { manager: string })?.manager).toBe(targetRecord.id);
});

test('set single record to new nested json field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah9j',
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

  const models: Array<Model> = [
    {
      slug: 'team',
      fields: [
        {
          slug: 'billing.invoiceRecipients',
          type: 'json',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "teams" SET "billing.invoiceRecipients" = ?1, "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?2) RETURNING *`,
      params: ['["receipts@test.co"]', 'tea_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(
    (result.record?.billing as { invoiceRecipients: Array<string> })?.invoiceRecipients,
  ).toEqual(['receipts@test.co']);
});

test('set single record to result of nested query', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah9j',
          },
          to: {
            name: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  account: {
                    with: { handle: 'david' },
                    selecting: ['lastName'],
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
          slug: 'lastName',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `UPDATE "teams" SET "name" = (SELECT "lastName" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z' WHERE ("id" = ?2) RETURNING *`,
      params: ['david', 'tea_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const [[targetRecord]] = await queryEphemeralDatabase(
    models,
    [
      {
        statement: `SELECT lastName FROM "accounts" WHERE ("handle" = 'david') LIMIT 1`,
        params: [],
      },
    ],
    false,
  );

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record?.name).toBe(targetRecord.lastName);
});

test('add multiple records with nested sub query', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          to: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: null,
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
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'user',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'INSERT INTO "users" SELECT * FROM "accounts" RETURNING *',
      params: [],
      returning: true,
    },
  ]);

  const [targetRecords] = await queryEphemeralDatabase(
    models,
    [
      {
        statement: `SELECT * FROM "accounts"`,
        params: [],
      },
      ...transaction.statements,
    ],
    false,
  );

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records.map(({ handle }) => ({ handle }))).toEqual(
    targetRecords.map(({ handle }) => ({ handle })),
  );
});

test('add multiple records with nested sub query including additional fields', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          to: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: {
                  including: {
                    nonExistingField: 'Custom Field Value',
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
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'user',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
        {
          slug: 'nonExistingField',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "users" SELECT *, ?1 as "nonExistingField" FROM "accounts" RETURNING *',
      params: ['Custom Field Value'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toMatchObject([
    {
      nonExistingField: 'Custom Field Value',
    },
    {
      nonExistingField: 'Custom Field Value',
    },
  ]);
});

test('add multiple records with nested sub query and specific fields', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          to: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: {
                  selecting: ['handle'],
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
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'user',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "users" ("handle", "id") SELECT "handle", "id" FROM "accounts" RETURNING *',
      params: [],
      returning: true,
    },
  ]);

  const [targetRecords] = await queryEphemeralDatabase(
    models,
    [
      {
        statement: `SELECT * FROM "accounts"`,
        params: [],
      },
    ],
    false,
  );

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records.map(({ handle }) => ({ handle }))).toEqual(
    targetRecords.map(({ handle }) => ({ handle })),
  );
});

test('add multiple records with nested sub query and specific meta fields', async () => {
  const queries: Array<Query> = [
    {
      add: {
        users: {
          to: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                accounts: {
                  selecting: ['ronin.updatedAt'],
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
      slug: 'user',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "users" ("ronin.updatedAt", "id") SELECT "ronin.updatedAt", "id" FROM "accounts" RETURNING *',
      params: [],
      returning: true,
    },
  ]);

  const [targetRecords] = await queryEphemeralDatabase(
    models,
    [
      {
        statement: `SELECT * FROM "accounts"`,
        params: [],
      },
    ],
    false,
  );

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(
    result.records.map(({ ronin: { updatedAt } }) => ({ ronin: { updatedAt } })),
  ).toEqual(
    targetRecords.map((targetRecord) => ({
      ronin: { updatedAt: targetRecord['ronin.updatedAt'] },
    })),
  );
});

// Ensure that an error is thrown for fields that don't exist in the target model, since
// the value of the field cannot be used in those cases.
test('try to add multiple records with nested sub query including non-existent fields', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          to: {
            [QUERY_SYMBOLS.QUERY]: {
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

  const models: Array<Model> = [
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
    new Transaction(queries, { models });
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'Field "nonExistingField" defined for `to` does not exist in model "New Account".',
  );
  expect(error).toHaveProperty('code', 'FIELD_NOT_FOUND');
  expect(error).toHaveProperty('field', 'nonExistingField');
});
