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
      statement: `SELECT * FROM "products" CROSS JOIN (SELECT * FROM "teams" LIMIT 1) as "including_team" LIMIT 1`,
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
      statement: `SELECT * FROM "members" LEFT JOIN "accounts" as "including_account" ON ("including_account"."id" = "members"."account") LIMIT 1`,
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
      statement: `SELECT * FROM \"members\" LEFT JOIN \"accounts\" as \"including_account\" ON (\"including_account\".\"id\" = ?1) LIMIT 1`,
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
      statement: `SELECT * FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "sub_accounts"."id")`,
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
      statement: `SELECT * FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "accounts"."id")`,
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
      statement: `SELECT * FROM "accounts" LEFT JOIN "members" as "including_ronin_root" ON ("including_ronin_root"."account" = "accounts"."id")`,
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
      statement: `SELECT * FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "accounts"."id") LEFT JOIN "teams" as "including_members[0].team" ON ("including_members[0].team"."id" = "including_members[0]"."team")`,
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
      statement: `SELECT * FROM "accounts" LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "accounts"."id") LEFT JOIN "teams" as "including_members[0]{1}" ON ("including_members[0]{1}"."id" = "including_members[0]"."team")`,
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
      statement: `SELECT * FROM (SELECT * FROM "products" LIMIT 1) as sub_products CROSS JOIN "beaches" as "including_beaches[0]"`,
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
      statement: `SELECT * FROM "products" CROSS JOIN (SELECT * FROM "beaches" ORDER BY "name" COLLATE NOCASE DESC LIMIT 1) as "including_beach" LIMIT 1`,
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
      statement: `SELECT * FROM (SELECT * FROM "products" LIMIT 1) as sub_products CROSS JOIN (SELECT * FROM "beaches" ORDER BY "name" COLLATE NOCASE DESC) as "including_beaches[0]"`,
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
      statement: `SELECT *, ?1 as "companyName" FROM "teams" LIMIT 1`,
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
      statement: `SELECT *, ("firstName" || ' ' || "lastName") as "fullName" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1`,
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
      statement: `SELECT *, ?1 as "sand.quality" FROM "beaches" LIMIT 1`,
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
