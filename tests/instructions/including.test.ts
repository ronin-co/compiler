import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import type { MultipleRecordResult, SingleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS } from '@/src/utils/helpers';

test('get single record including unrelated record without filter', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          including: {
            team: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  team: null,
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
    },
    {
      slug: 'product',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "products"."id", "products"."ronin.locked", "products"."ronin.createdAt", "products"."ronin.createdBy", "products"."ronin.updatedAt", "products"."ronin.updatedBy", "including_team"."id" as "team.id", "including_team"."ronin.locked" as "team.ronin.locked", "including_team"."ronin.createdAt" as "team.ronin.createdAt", "including_team"."ronin.createdBy" as "team.ronin.createdBy", "including_team"."ronin.updatedAt" as "team.ronin.updatedAt", "including_team"."ronin.updatedBy" as "team.ronin.updatedBy" FROM "products" CROSS JOIN (SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy" FROM "teams" LIMIT 1) as "including_team" LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    team: {
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

test('get single record including unrelated record with filter', async () => {
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "members"."id", "members"."ronin.locked", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."id" as "account.id", "including_account"."ronin.locked" as "account.ronin.locked", "including_account"."ronin.createdAt" as "account.ronin.createdAt", "including_account"."ronin.createdBy" as "account.ronin.createdBy", "including_account"."ronin.updatedAt" as "account.ronin.updatedAt", "including_account"."ronin.updatedBy" as "account.ronin.updatedBy" FROM "members" LEFT JOIN "accounts" as "including_account" ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

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

test('get single record including unrelated record that is not found', async () => {
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
                      id: '1234',
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "members"."id", "members"."ronin.locked", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."id" as "account.id", "including_account"."ronin.locked" as "account.ronin.locked", "including_account"."ronin.createdAt" as "account.ronin.createdAt", "including_account"."ronin.createdBy" as "account.ronin.createdBy", "including_account"."ronin.updatedAt" as "account.ronin.updatedAt", "including_account"."ronin.updatedBy" as "account.ronin.updatedBy" FROM "members" LEFT JOIN "accounts" as "including_account" ON ("including_account"."id" = ?1) LIMIT 1`,
      params: ['1234'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    account: null,
  });
});

test('get single record including unrelated record with filter and specific fields', async () => {
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
                    selecting: ['firstName'],
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
          slug: 'firstName',
          type: 'string',
        },
      ],
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "members"."id", "members"."ronin.locked", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."firstName" as "account.firstName" FROM "members" LEFT JOIN "accounts" as "including_account" ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

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
      firstName: expect.any(String),
    },
  });
});

test('get single record including unrelated records without filter', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          including: {
            beaches: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  beaches: null,
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
      slug: 'beach',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
    {
      slug: 'product',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_products"."id", "sub_products"."ronin.locked", "sub_products"."ronin.createdAt", "sub_products"."ronin.createdBy", "sub_products"."ronin.updatedAt", "sub_products"."ronin.updatedBy", "sub_products"."name", "including_beaches[0]"."id" as "beaches[0].id", "including_beaches[0]"."ronin.locked" as "beaches[0].ronin.locked", "including_beaches[0]"."ronin.createdAt" as "beaches[0].ronin.createdAt", "including_beaches[0]"."ronin.createdBy" as "beaches[0].ronin.createdBy", "including_beaches[0]"."ronin.updatedAt" as "beaches[0].ronin.updatedAt", "including_beaches[0]"."ronin.updatedBy" as "beaches[0].ronin.updatedBy", "including_beaches[0]"."name" as "beaches[0].name" FROM (SELECT * FROM "products" LIMIT 1) as sub_products CROSS JOIN "beaches" as "including_beaches[0]"`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    beaches: new Array(4).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      name: expect.any(String),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
    }),
  });
});

test('get single record including unrelated records with filter', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          including: {
            members: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  members: {
                    with: {
                      account: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_accounts"."id", "sub_accounts"."ronin.locked", "sub_accounts"."ronin.createdAt", "sub_accounts"."ronin.createdBy", "sub_accounts"."ronin.updatedAt", "sub_accounts"."ronin.updatedBy", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account" FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "sub_accounts"."id")`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    members: [
      {
        account: expect.stringMatching(RECORD_ID_REGEX),
        id: expect.stringMatching(RECORD_ID_REGEX),
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        account: expect.stringMatching(RECORD_ID_REGEX),
        id: expect.stringMatching(RECORD_ID_REGEX),
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

test('get single record including unrelated records that are not found', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          including: {
            members: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  members: {
                    with: {
                      account: '1234',
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_accounts"."id", "sub_accounts"."ronin.locked", "sub_accounts"."ronin.createdAt", "sub_accounts"."ronin.createdBy", "sub_accounts"."ronin.updatedAt", "sub_accounts"."ronin.updatedBy", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account" FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = ?1)`,
      params: ['1234'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    members: [],
  });
});

test('get multiple records including unrelated records with filter', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          including: {
            members: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  members: {
                    with: {
                      account: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "accounts"."id", "accounts"."ronin.locked", "accounts"."ronin.createdAt", "accounts"."ronin.createdBy", "accounts"."ronin.updatedAt", "accounts"."ronin.updatedBy", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account" FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "accounts"."id")`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      members: new Array(2).fill({
        account: expect.stringMatching(RECORD_ID_REGEX),
        id: expect.stringMatching(RECORD_ID_REGEX),
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      }),
    },
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      members: [
        {
          account: expect.stringMatching(RECORD_ID_REGEX),
          id: expect.stringMatching(RECORD_ID_REGEX),
          ronin: {
            locked: false,
            createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            createdBy: null,
            updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            updatedBy: null,
          },
        },
      ],
    },
  ]);
});

test('get multiple records including unrelated records that are not found', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          including: {
            members: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  members: {
                    with: {
                      account: '1234',
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "accounts"."id", "accounts"."ronin.locked", "accounts"."ronin.createdAt", "accounts"."ronin.createdBy", "accounts"."ronin.updatedAt", "accounts"."ronin.updatedBy", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account" FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = ?1)`,
      params: ['1234'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      members: [],
    },
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      members: [],
    },
  ]);
});

// In this test, the results of the joined table will not be mounted at a dedicated
// field on the parent record. Instead, the fields of the joined records will be merged
// into the parent record.
test('get multiple records including unrelated records with filter (hoisted)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          including: {
            [QUERY_SYMBOLS.QUERY]: {
              get: {
                members: {
                  with: {
                    account: {
                      [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
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
          type: 'string',
        },
        {
          slug: 'team',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "accounts"."id", "accounts"."ronin.locked", "accounts"."ronin.createdAt", "accounts"."ronin.createdBy", "accounts"."ronin.updatedAt", "accounts"."ronin.updatedBy", "accounts"."handle", "including_ronin_root"."id" as "ronin_root.id", "including_ronin_root"."ronin.locked" as "ronin_root.ronin.locked", "including_ronin_root"."ronin.createdAt" as "ronin_root.ronin.createdAt", "including_ronin_root"."ronin.createdBy" as "ronin_root.ronin.createdBy", "including_ronin_root"."ronin.updatedAt" as "ronin_root.ronin.updatedAt", "including_ronin_root"."ronin.updatedBy" as "ronin_root.ronin.updatedBy", "including_ronin_root"."account" as "ronin_root.account", "including_ronin_root"."team" as "ronin_root.team" FROM "accounts" LEFT JOIN "members" as "including_ronin_root" ON ("including_ronin_root"."account" = "accounts"."id")`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toEqual(
    new Array(3).fill({
      handle: expect.any(String),
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      // These fields are expected to be present, since they are part of the joined model.
      account: expect.stringMatching(RECORD_ID_REGEX),
      team: expect.stringMatching(RECORD_ID_REGEX),
    }),
  );
});

test('get multiple records including unrelated records with filter (nested)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          // Perform a LEFT JOIN that adds the `members` table.
          including: {
            members: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  members: {
                    // ON members.account = accounts.id
                    with: {
                      account: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
                      },
                    },

                    // Perform a LEFT JOIN that adds the `teams` table.
                    including: {
                      team: {
                        [QUERY_SYMBOLS.QUERY]: {
                          get: {
                            team: {
                              // ON teams.id = members.team
                              with: {
                                id: {
                                  [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}team`,
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
          slug: 'locations',
          type: 'json',
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
      ],
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'string',
        },
        {
          slug: 'team',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "accounts"."id", "accounts"."ronin.locked", "accounts"."ronin.createdAt", "accounts"."ronin.createdBy", "accounts"."ronin.updatedAt", "accounts"."ronin.updatedBy", "accounts"."handle", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account", "including_members[0]"."team" as "members[0].team", "including_members[0].team"."id" as "members[0].team.id", "including_members[0].team"."ronin.locked" as "members[0].team.ronin.locked", "including_members[0].team"."ronin.createdAt" as "members[0].team.ronin.createdAt", "including_members[0].team"."ronin.createdBy" as "members[0].team.ronin.createdBy", "including_members[0].team"."ronin.updatedAt" as "members[0].team.ronin.updatedAt", "including_members[0].team"."ronin.updatedBy" as "members[0].team.ronin.updatedBy", "including_members[0].team"."locations" as "members[0].team.locations" FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "accounts"."id") LEFT JOIN "teams" as "including_members[0].team" ON ("including_members[0].team"."id" = "including_members[0]"."team")`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);

  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
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
          id: 'mem_39h8fhe98hefah0j',
          account: 'acc_39h8fhe98hefah8j',
          team: {
            id: 'tea_39h8fhe98hefah9j',
            locations: {
              europe: 'london',
            },
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
        },
        {
          id: 'mem_39h8fhe98hefah8j',
          account: 'acc_39h8fhe98hefah8j',
          team: {
            id: 'tea_39h8fhe98hefah8j',
            locations: {
              europe: 'berlin',
            },
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
        },
      ],
    },
    {
      id: 'acc_39h8fhe98hefah9j',
      handle: 'david',
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      members: [
        {
          id: 'mem_39h8fhe98hefah9j',
          account: 'acc_39h8fhe98hefah9j',
          team: {
            id: 'tea_39h8fhe98hefah8j',
            locations: {
              europe: 'berlin',
            },
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
        },
      ],
    },
  ]);
});

// In this test, the results of the joined table will not be mounted at a dedicated
// field on the parent record. Instead, the fields of the joined records will be merged
// into the parent record.
test('get multiple records including unrelated records with filter (nested, hoisted)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          // Perform a LEFT JOIN that adds the `members` table.
          including: {
            members: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  members: {
                    // ON members.account = accounts.id
                    with: {
                      account: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
                      },
                    },

                    // Perform a LEFT JOIN that adds the `teams` table.
                    including: {
                      [QUERY_SYMBOLS.QUERY]: {
                        get: {
                          team: {
                            // ON teams.id = members.team
                            with: {
                              id: {
                                [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}team`,
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
          slug: 'locations',
          type: 'json',
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
      ],
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'string',
        },
        {
          slug: 'team',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "accounts"."id", "accounts"."ronin.locked", "accounts"."ronin.createdAt", "accounts"."ronin.createdBy", "accounts"."ronin.updatedAt", "accounts"."ronin.updatedBy", "accounts"."handle", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account", "including_members[0]"."team" as "members[0].team", "including_members[0]{1}"."id" as "members[0]{1}.id", "including_members[0]{1}"."ronin.locked" as "members[0]{1}.ronin.locked", "including_members[0]{1}"."ronin.createdAt" as "members[0]{1}.ronin.createdAt", "including_members[0]{1}"."ronin.createdBy" as "members[0]{1}.ronin.createdBy", "including_members[0]{1}"."ronin.updatedAt" as "members[0]{1}.ronin.updatedAt", "including_members[0]{1}"."ronin.updatedBy" as "members[0]{1}.ronin.updatedBy", "including_members[0]{1}"."locations" as "members[0]{1}.locations" FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "accounts"."id") LEFT JOIN "teams" as "including_members[0]{1}" ON ("including_members[0]{1}"."id" = "including_members[0]"."team")`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);

  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
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
          id: 'tea_39h8fhe98hefah9j',
          locations: {
            europe: 'london',
          },
          ronin: {
            locked: false,
            createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            createdBy: null,
            updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            updatedBy: null,
          },
          // These fields are expected to be present, since they are part of the model
          // between the first and third model being joined (the second model).
          account: 'acc_39h8fhe98hefah8j',
          team: 'tea_39h8fhe98hefah9j',
        },
        {
          id: 'tea_39h8fhe98hefah8j',
          locations: {
            europe: 'berlin',
          },
          ronin: {
            locked: false,
            createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            createdBy: null,
            updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            updatedBy: null,
          },
          // These fields are expected to be present, since they are part of the model
          // between the first and third model being joined (the second model).
          account: 'acc_39h8fhe98hefah8j',
          team: 'tea_39h8fhe98hefah8j',
        },
      ],
    },
    {
      id: 'acc_39h8fhe98hefah9j',
      handle: 'david',
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      members: [
        {
          id: 'tea_39h8fhe98hefah8j',
          locations: {
            europe: 'berlin',
          },
          ronin: {
            locked: false,
            createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            createdBy: null,
            updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
            updatedBy: null,
          },
          // These fields are expected to be present, since they are part of the model
          // between the first and third model being joined (the second model).
          account: 'acc_39h8fhe98hefah9j',
          team: 'tea_39h8fhe98hefah8j',
        },
      ],
    },
  ]);
});

test('get multiple records including count of unrelated records', async () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          including: {
            memberAmount: {
              [QUERY_SYMBOLS.QUERY]: {
                count: {
                  members: {
                    with: {
                      account: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}id`,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", (SELECT (COUNT(*)) as "amount" FROM "members" WHERE "account" = "accounts"."id") as "memberAmount" FROM "accounts"`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as MultipleRecordResult;

  expect(result.records).toEqual([
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      memberAmount: 2,
    },
    {
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      memberAmount: 1,
    },
  ]);
});

test('get single record including unrelated ordered record', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          including: {
            beach: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  beach: {
                    orderedBy: {
                      descending: ['name'],
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
      slug: 'beach',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
    {
      slug: 'product',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "products"."id", "products"."ronin.locked", "products"."ronin.createdAt", "products"."ronin.createdBy", "products"."ronin.updatedAt", "products"."ronin.updatedBy", "products"."name", "including_beach"."id" as "beach.id", "including_beach"."ronin.locked" as "beach.ronin.locked", "including_beach"."ronin.createdAt" as "beach.ronin.createdAt", "including_beach"."ronin.createdBy" as "beach.ronin.createdBy", "including_beach"."ronin.updatedAt" as "beach.ronin.updatedAt", "including_beach"."ronin.updatedBy" as "beach.ronin.updatedBy", "including_beach"."name" as "beach.name" FROM "products" CROSS JOIN (SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" ORDER BY "name" COLLATE NOCASE DESC LIMIT 1) as "including_beach" LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    beach: {
      id: 'bea_39h8fhe98hefah9j',
      name: 'Manly',
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

test('get single record including unrelated ordered records', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          including: {
            beaches: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  beaches: {
                    orderedBy: {
                      descending: ['name'],
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
      slug: 'beach',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
    {
      slug: 'product',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_products"."id", "sub_products"."ronin.locked", "sub_products"."ronin.createdAt", "sub_products"."ronin.createdBy", "sub_products"."ronin.updatedAt", "sub_products"."ronin.updatedBy", "sub_products"."name", "including_beaches[0]"."id" as "beaches[0].id", "including_beaches[0]"."ronin.locked" as "beaches[0].ronin.locked", "including_beaches[0]"."ronin.createdAt" as "beaches[0].ronin.createdAt", "including_beaches[0]"."ronin.createdBy" as "beaches[0].ronin.createdBy", "including_beaches[0]"."ronin.updatedAt" as "beaches[0].ronin.updatedAt", "including_beaches[0]"."ronin.updatedBy" as "beaches[0].ronin.updatedBy", "including_beaches[0]"."name" as "beaches[0].name" FROM (SELECT * FROM "products" LIMIT 1) as sub_products CROSS JOIN (SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name" FROM "beaches" ORDER BY "name" COLLATE NOCASE DESC) as "including_beaches[0]"`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    name: expect.any(String),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    beaches: [
      {
        id: 'bea_39h8fhe98hefah8j',
        name: 'Bondi',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        id: 'bea_39h8fhe98hefah9j',
        name: 'Manly',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        id: 'bea_39h8fhe98hefah0j',
        name: 'Coogee',
        ronin: {
          locked: false,
          createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          createdBy: null,
          updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
          updatedBy: null,
        },
      },
      {
        id: 'bea_39h8fhe98hefah1j',
        name: 'Cronulla',
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

test('get single record including ephemeral field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        team: {
          including: {
            companyName: 'Example Company',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", ?1 as "companyName" FROM "teams" LIMIT 1`,
      params: ['Example Company'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    companyName: 'Example Company',
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
  });
});

test('get single record including ephemeral field containing expression', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: { handle: 'elaine' },
          including: {
            fullName: {
              [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD}firstName || ' ' || ${QUERY_SYMBOLS.FIELD}lastName`,
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
          slug: 'firstName',
          type: 'string',
        },
        {
          slug: 'lastName',
          type: 'string',
        },
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
      statement: `SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "firstName", "lastName", "handle", ("firstName" || ' ' || "lastName") as "fullName" FROM "accounts" WHERE "handle" = ?1 LIMIT 1`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    fullName: 'Elaine Jones',
    handle: 'elaine',
    firstName: 'Elaine',
    lastName: 'Jones',
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
  });
});

test('get single record including deeply nested ephemeral field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          including: {
            sand: {
              quality: 'extraordinary',
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'beach',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", ?1 as "sand.quality" FROM "beaches" LIMIT 1`,
      params: ['extraordinary'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: expect.stringMatching(RECORD_ID_REGEX),
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    sand: {
      quality: 'extraordinary',
    },
  });
});
