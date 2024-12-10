import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import type { SingleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS, RoninError } from '@/src/utils/helpers';

test('get single record for preset', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          for: ['specificAccount'],
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
          type: 'link',
          target: 'account',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              account: {
                being: 'acc_39h8fhe98hefah9j',
              },
            },
          },
          slug: 'specificAccount',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "members" WHERE ("account" = ?1) LIMIT 1',
      params: ['acc_39h8fhe98hefah9j'],
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
    account: 'acc_39h8fhe98hefah9j',
  });
});

test('get single record for preset containing field with condition', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: {
            activeMember: 'acc_39h8fhe98hefah8j',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'space',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'link',
          target: 'account',
        },
        {
          slug: 'space',
          type: 'link',
          target: 'space',
        },
        {
          slug: 'activeAt',
          type: 'date',
        },
      ],
    },
    {
      slug: 'view',
      fields: [
        {
          slug: 'space',
          type: 'link',
          target: 'space',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              space: {
                notBeing: {
                  [QUERY_SYMBOLS.QUERY]: {
                    get: {
                      member: {
                        with: { account: QUERY_SYMBOLS.VALUE },
                        orderedBy: { descending: ['activeAt'] },
                        selecting: ['space'],
                      },
                    },
                  },
                },
              },
            },
          },
          slug: 'activeMember',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT * FROM "views" WHERE ("space" != (SELECT "space" FROM "members" WHERE ("account" = ?1) ORDER BY "activeAt" DESC LIMIT 1)) LIMIT 1',
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);
});

test('get single record for preset containing field without condition', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: {
            activeMember: 'acc_39h8fhe98hefah8j',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'space',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'link',
          target: 'account',
        },
        {
          slug: 'space',
          type: 'link',
          target: 'space',
        },
        {
          slug: 'activeAt',
          type: 'date',
        },
      ],
    },
    {
      slug: 'view',
      fields: [
        {
          slug: 'space',
          type: 'link',
          target: 'space',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              space: {
                [QUERY_SYMBOLS.QUERY]: {
                  get: {
                    member: {
                      with: { account: QUERY_SYMBOLS.VALUE },
                      orderedBy: { descending: ['activeAt'] },
                      selecting: ['space'],
                    },
                  },
                },
              },
            },
          },
          slug: 'activeMember',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT * FROM "views" WHERE ("space" = (SELECT "space" FROM "members" WHERE ("account" = ?1) ORDER BY "activeAt" DESC LIMIT 1)) LIMIT 1',
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);
});

test('get single record for preset on existing object instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: 'acc_39h8fhe98hefah8j',
          },
          for: ['specificSpace'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'space',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'link',
          target: 'account',
        },
        {
          slug: 'space',
          type: 'link',
          target: 'space',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              space: 'spa_m9h8oha94helaji',
            },
          },
          slug: 'specificSpace',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT * FROM "members" WHERE ("space" = ?1 AND "account" = ?2) LIMIT 1',
      params: ['spa_m9h8oha94helaji', 'acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);
});

test('get single record for preset on existing array instruction', () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          selecting: ['account'],
          for: ['selectedSpace'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'space',
    },
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'link',
          target: 'account',
        },
        {
          slug: 'space',
          type: 'link',
          target: 'space',
        },
      ],
      presets: [
        {
          instructions: {
            selecting: ['space'],
          },
          slug: 'selectedSpace',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "space", "account" FROM "members" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including parent record (many-to-one)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          for: ['account'],
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
          type: 'link',
          target: 'account',
          kind: 'one',
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
      statement: `SELECT "members"."id", "members"."ronin.locked", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."id" as "including_account.id", "including_account"."ronin.locked" as "including_account.ronin.locked", "including_account"."ronin.createdAt" as "including_account.ronin.createdAt", "including_account"."ronin.createdBy" as "including_account.ronin.createdBy", "including_account"."ronin.updatedAt" as "including_account.ronin.updatedAt", "including_account"."ronin.updatedBy" as "including_account.ronin.updatedBy" FROM "members" LEFT JOIN "accounts" as including_account ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
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
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
  });
});

test('get single record including child records (one-to-many, defined manually)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          for: ['visitors'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
    },
    {
      slug: 'beach',
      fields: [
        {
          slug: 'visitors',
          type: 'link',
          target: 'account',
          kind: 'many',
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
      statement: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.locked", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_visitors"."id" as "including_visitors.id", "including_visitors"."ronin.locked" as "including_visitors.ronin.locked", "including_visitors"."ronin.createdAt" as "including_visitors.ronin.createdAt", "including_visitors"."ronin.createdBy" as "including_visitors.ronin.createdBy", "including_visitors"."ronin.updatedAt" as "including_visitors.ronin.updatedAt", "including_visitors"."ronin.updatedBy" as "including_visitors.ronin.updatedBy", "including_visitors"."source" as "including_visitors.source", "including_visitors"."target" as "including_visitors.target" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_visitors" as including_visitors ON ("including_visitors"."source" = "sub_beaches"."id")`,
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
    visitors: [
      {
        id: expect.stringMatching(RECORD_ID_REGEX),
        source: 'bea_39h8fhe98hefah8j',
        target: 'acc_39h8fhe98hefah8j',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        id: expect.stringMatching(RECORD_ID_REGEX),
        source: 'bea_39h8fhe98hefah8j',
        target: 'acc_39h8fhe98hefah9j',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
    ],
  });
});

test('get single record including child records (one-to-many, defined automatically)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: { handle: 'elaine' },
          for: ['members'],
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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_accounts"."id", "sub_accounts"."ronin.locked", "sub_accounts"."ronin.createdAt", "sub_accounts"."ronin.createdBy", "sub_accounts"."ronin.updatedAt", "sub_accounts"."ronin.updatedBy", "sub_accounts"."handle", "including_members"."id" as "including_members.id", "including_members"."ronin.locked" as "including_members.ronin.locked", "including_members"."ronin.createdAt" as "including_members.ronin.createdAt", "including_members"."ronin.createdBy" as "including_members.ronin.createdBy", "including_members"."ronin.updatedAt" as "including_members.ronin.updatedAt", "including_members"."ronin.updatedBy" as "including_members.ronin.updatedBy", "including_members"."account" as "including_members.account" FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as including_members ON ("including_members"."account" = "sub_accounts"."id") WHERE ("sub_accounts"."handle" = ?1)`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'acc_39h8fhe98hefah8j',
    handle: 'elaine',
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    members: [
      {
        id: 'mem_39h8fhe98hefah8j',
        account: 'acc_39h8fhe98hefah8j',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        id: 'mem_39h8fhe98hefah0j',
        account: 'acc_39h8fhe98hefah8j',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
    ],
  });
});

test('try get single record with non-existing preset', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          for: {
            activeMember: 'acc_39h8fhe98hefah8j',
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
    'Preset "activeMember" does not exist in model "Account".',
  );
  expect(error).toHaveProperty('code', 'PRESET_NOT_FOUND');
});
