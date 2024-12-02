import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

import { queryEphemeralDatabase } from '@/fixtures/utils';
import type { SingleRecordResult } from '@/src/types/result';
import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  RONIN_MODEL_SYMBOLS,
  RoninError,
} from '@/src/utils/helpers';

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
      statement: `UPDATE "accounts" SET "handle" = ?1, "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: ['mia', expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'elaine'],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

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
              [RONIN_MODEL_SYMBOLS.EXPRESSION]: `LOWER(${RONIN_MODEL_SYMBOLS.FIELD}firstName || ${RONIN_MODEL_SYMBOLS.FIELD}lastName)`,
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
      statement: `UPDATE "accounts" SET "handle" = LOWER("firstName" || "lastName"), "ronin.updatedAt" = ?1 WHERE ("handle" = ?2) RETURNING *`,
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'elaine'],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('elainejones');
});

test('set single record to new one-cardinality link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        member: {
          with: {
            id: 'mem_39h8fhe98hefah9',
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
      statement: `UPDATE "members" SET "account" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'elaine',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'mem_39h8fhe98hefah9',
      ],
      returning: true,
    },
  ]);

  const [[targetRecord], ...rows] = await queryEphemeralDatabase(models, [
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
      params: [],
    },
    ...transaction.statements,
  ]);

  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record?.account).toBe(targetRecord.id);
});

test('set single record to new many-cardinality link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            id: 'acc_39h8fhe98hefah8',
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
      params: ['acc_39h8fhe98hefah8'],
    },
    {
      statement:
        'INSERT INTO "ronin_link_account_followers" ("source", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "accounts" WHERE ("handle" = ?2) LIMIT 1), ?3, ?4, ?5)',
      params: [
        'acc_39h8fhe98hefah8',
        'david',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'UPDATE "accounts" SET "ronin.updatedAt" = ?1 WHERE ("id" = ?2) RETURNING *',
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'acc_39h8fhe98hefah8'],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field (add)', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            id: 'acc_39h8fhe98hefah8',
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
        'INSERT INTO "ronin_link_account_followers" ("source", "target", "id", "ronin.createdAt", "ronin.updatedAt") VALUES (?1, (SELECT "id" FROM "accounts" WHERE ("handle" = ?2) LIMIT 1), ?3, ?4, ?5)',
      params: [
        'acc_39h8fhe98hefah8',
        'david',
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
    },
    {
      statement:
        'UPDATE "accounts" SET "ronin.updatedAt" = ?1 WHERE ("id" = ?2) RETURNING *',
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'acc_39h8fhe98hefah8'],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record?.followers).toBeUndefined();
  expect(result.record?.ronin.updatedAt).toMatch(RECORD_TIMESTAMP_REGEX);
});

test('set single record to new many-cardinality link field (remove)', async () => {
  const queries: Array<Query> = [
    {
      set: {
        account: {
          with: {
            id: 'acc_39h8fhe98hefah8',
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
      params: ['acc_39h8fhe98hefah8', 'david'],
    },
    {
      statement:
        'UPDATE "accounts" SET "ronin.updatedAt" = ?1 WHERE ("id" = ?2) RETURNING *',
      params: [expect.stringMatching(RECORD_TIMESTAMP_REGEX), 'acc_39h8fhe98hefah8'],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

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
      statement: `UPDATE "accounts" SET "emails" = ?1, "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: [
        '["elaine@site.co","elaine@company.co"]',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'elaine',
      ],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

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
      statement: `UPDATE "accounts" SET "emails" = ?1, "ronin.updatedAt" = ?2 WHERE ("handle" = ?3) RETURNING *`,
      params: [
        '{"site":"elaine@site.co","hobby":"dancer@dancing.co"}',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'elaine',
      ],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record?.emails).toEqual({
    site: 'elaine@site.co',
    hobby: 'dancer@dancing.co',
  });
});

test('set single record to new grouped string field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah8',
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
          slug: 'billing',
          type: 'group',
        },
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
      statement: `UPDATE "teams" SET "billing.currency" = ?1, "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'USD',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_39h8fhe98hefah8',
      ],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect((result.record?.billing as { currency: string })?.currency).toBe('USD');
});

test('set single record to new grouped link field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah8',
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
          slug: 'billing',
          type: 'group',
        },
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
      statement: `UPDATE "teams" SET "billing.manager" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'elaine',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_39h8fhe98hefah8',
      ],
      returning: true,
    },
  ]);

  const [[targetRecord], ...rows] = await queryEphemeralDatabase(models, [
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
      params: [],
    },
    ...transaction.statements,
  ]);

  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect((result.record?.billing as { manager: string })?.manager).toBe(targetRecord.id);
});

test('set single record to new grouped json field', async () => {
  const queries: Array<Query> = [
    {
      set: {
        team: {
          with: {
            id: 'tea_39h8fhe98hefah9',
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
          slug: 'billing',
          type: 'group',
        },
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
      statement: `UPDATE "teams" SET "billing.invoiceRecipients" = ?1, "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        '["receipts@test.co"]',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_39h8fhe98hefah9',
      ],
      returning: true,
    },
  ]);

  const rows = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

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
            id: 'tea_39h8fhe98hefah9',
          },
          to: {
            name: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
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
      statement: `UPDATE "teams" SET "name" = (SELECT "lastName" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1), "ronin.updatedAt" = ?2 WHERE ("id" = ?3) RETURNING *`,
      params: [
        'david',
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        'tea_39h8fhe98hefah9',
      ],
      returning: true,
    },
  ]);

  const [[targetRecord], ...rows] = await queryEphemeralDatabase(models, [
    {
      statement: `SELECT lastName FROM "accounts" WHERE ("handle" = 'david') LIMIT 1`,
      params: [],
    },
    ...transaction.statements,
  ]);

  const result = transaction.prepareResults(rows)[0] as SingleRecordResult;

  expect(result.record?.name).toBe(targetRecord.lastName);
});

test('add multiple records with nested sub query', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          to: {
            [RONIN_MODEL_SYMBOLS.QUERY]: {
              get: {
                oldAccounts: null,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `INSERT INTO "new_accounts" SELECT * FROM "old_accounts" RETURNING *`,
      params: [],
      returning: true,
    },
  ]);
});

test('add multiple records with nested sub query including additional fields', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          to: {
            [RONIN_MODEL_SYMBOLS.QUERY]: {
              get: {
                oldAccounts: {
                  including: {
                    firstName: 'custom-first-name',
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
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "new_accounts" SELECT *, ?1 as "firstName" FROM "old_accounts" RETURNING *',
      params: ['custom-first-name'],
      returning: true,
    },
  ]);
});

test('add multiple records with nested sub query and specific fields', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          to: {
            [RONIN_MODEL_SYMBOLS.QUERY]: {
              get: {
                oldAccounts: {
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "new_accounts" SELECT "handle", ?1 as "id", ?2 as "ronin.createdAt", ?3 as "ronin.updatedAt" FROM "old_accounts" RETURNING *',
      params: [
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

test('add multiple records with nested sub query and specific meta fields', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          to: {
            [RONIN_MODEL_SYMBOLS.QUERY]: {
              get: {
                oldAccounts: {
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'INSERT INTO "new_accounts" SELECT "ronin.updatedAt", ?1 as "id", ?2 as "ronin.createdAt" FROM "old_accounts" RETURNING *',
      params: [
        expect.stringMatching(RECORD_ID_REGEX),
        expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      ],
      returning: true,
    },
  ]);
});

// Ensure that an error is thrown for fields that don't exist in the target model, since
// the value of the field cannot be used in those cases.
test('try to add multiple records with nested sub query including non-existent fields', () => {
  const queries: Array<Query> = [
    {
      add: {
        newAccounts: {
          to: {
            [RONIN_MODEL_SYMBOLS.QUERY]: {
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
