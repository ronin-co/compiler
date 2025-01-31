import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import type { SingleRecordResult } from '@/src/types/result';
import { QUERY_SYMBOLS, RoninError } from '@/src/utils/helpers';

test('get single record using preset', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          using: ['specificAccount'],
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
      statement:
        'SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account" FROM "members" WHERE "account" = ?1 LIMIT 1',
      params: ['acc_39h8fhe98hefah9j'],
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
    account: 'acc_39h8fhe98hefah9j',
  });
});

test('get single record using preset containing field with condition', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          using: {
            activeMember: 'acc_39h8fhe98hefah8j',
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
          slug: 'team',
          type: 'link',
          target: 'team',
        },
        {
          slug: 'activeAt',
          type: 'date',
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
        {
          slug: 'team',
          type: 'link',
          target: 'team',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              team: {
                being: {
                  [QUERY_SYMBOLS.QUERY]: {
                    get: {
                      member: {
                        with: { account: QUERY_SYMBOLS.VALUE },
                        orderedBy: { descending: ['activeAt'] },
                        selecting: ['team'],
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
        'SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "team" FROM "products" WHERE "team" = (SELECT "team" FROM "members" WHERE "account" = ?1 ORDER BY "activeAt" DESC LIMIT 1) LIMIT 1',
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'pro_39h8fhe98hefah8j',
    name: 'Apple',
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    team: 'tea_39h8fhe98hefah8j',
  });
});

test('get single record using preset containing field without condition', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          using: {
            activeMember: 'acc_39h8fhe98hefah8j',
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
          slug: 'team',
          type: 'link',
          target: 'team',
        },
        {
          slug: 'activeAt',
          type: 'date',
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
        {
          slug: 'team',
          type: 'link',
          target: 'team',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              team: {
                [QUERY_SYMBOLS.QUERY]: {
                  get: {
                    member: {
                      with: { account: QUERY_SYMBOLS.VALUE },
                      orderedBy: { descending: ['activeAt'] },
                      selecting: ['team'],
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
        'SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "name", "team" FROM "products" WHERE "team" = (SELECT "team" FROM "members" WHERE "account" = ?1 ORDER BY "activeAt" DESC LIMIT 1) LIMIT 1',
      params: ['acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'pro_39h8fhe98hefah8j',
    name: 'Apple',
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    team: 'tea_39h8fhe98hefah8j',
  });
});

test('get single record using preset on existing object instruction', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: 'acc_39h8fhe98hefah8j',
          },
          using: ['specificTeam'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
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
          slug: 'team',
          type: 'link',
          target: 'team',
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              team: 'tea_39h8fhe98hefah9j',
            },
          },
          slug: 'specificTeam',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT "id", "ronin.locked", "ronin.createdAt", "ronin.createdBy", "ronin.updatedAt", "ronin.updatedBy", "account", "team" FROM "members" WHERE "team" = ?1 AND "account" = ?2 LIMIT 1',
      params: ['tea_39h8fhe98hefah9j', 'acc_39h8fhe98hefah8j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

  expect(result.record).toEqual({
    id: 'mem_39h8fhe98hefah0j',
    ronin: {
      locked: false,
      createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      createdBy: null,
      updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
      updatedBy: null,
    },
    account: 'acc_39h8fhe98hefah8j',
    team: 'tea_39h8fhe98hefah9j',
  });
});

test('get single record using preset on existing array instruction', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          selecting: ['account'],
          using: ['selectedTeam'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'team',
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
          slug: 'team',
          type: 'link',
          target: 'team',
        },
      ],
      presets: [
        {
          instructions: {
            selecting: ['team'],
          },
          slug: 'selectedTeam',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT "team", "account" FROM "members" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(
    rawResults,
    false,
  )[0] as unknown as SingleRecordResult<{ account: string; team: string }>;

  expect(result.record).toEqual({
    account: 'acc_39h8fhe98hefah8j',
    team: 'tea_39h8fhe98hefah8j',
  });
});

test('get single record including parent record (many-to-one)', async () => {
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
          using: ['visitors'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        { slug: 'handle', type: 'string' },
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.locked", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_visitors[0]"."id" as "visitors[0].id", "including_visitors[0]"."ronin.locked" as "visitors[0].ronin.locked", "including_visitors[0]"."ronin.createdAt" as "visitors[0].ronin.createdAt", "including_visitors[0]"."ronin.createdBy" as "visitors[0].ronin.createdBy", "including_visitors[0]"."ronin.updatedAt" as "visitors[0].ronin.updatedAt", "including_visitors[0]"."ronin.updatedBy" as "visitors[0].ronin.updatedBy", "including_visitors[0]{1}"."id" as "visitors[0]{1}.id", "including_visitors[0]{1}"."ronin.locked" as "visitors[0]{1}.ronin.locked", "including_visitors[0]{1}"."ronin.createdAt" as "visitors[0]{1}.ronin.createdAt", "including_visitors[0]{1}"."ronin.createdBy" as "visitors[0]{1}.ronin.createdBy", "including_visitors[0]{1}"."ronin.updatedAt" as "visitors[0]{1}.ronin.updatedAt", "including_visitors[0]{1}"."ronin.updatedBy" as "visitors[0]{1}.ronin.updatedBy", "including_visitors[0]{1}"."handle" as "visitors[0]{1}.handle", "including_visitors[0]{1}"."firstName" as "visitors[0]{1}.firstName" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_visitors" as "including_visitors[0]" ON ("including_visitors[0]"."source" = "sub_beaches"."id") LEFT JOIN "accounts" as "including_visitors[0]{1}" ON ("including_visitors[0]{1}"."id" = "including_visitors[0]"."target")`,
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
    visitors: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: expect.any(String),
      firstName: expect.any(String),
    }),
  });
});

test('get single record including child records (one-to-many, defined manually, multiple fields)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          using: ['visitors', 'volleyballTeams'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        { slug: 'handle', type: 'string' },
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
    },
    {
      slug: 'team',
      fields: [{ slug: 'locations', type: 'json' }],
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
        {
          slug: 'volleyballTeams',
          type: 'link',
          target: 'team',
          kind: 'many',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.locked", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_volleyballTeams[0]"."id" as "volleyballTeams[0].id", "including_volleyballTeams[0]"."ronin.locked" as "volleyballTeams[0].ronin.locked", "including_volleyballTeams[0]"."ronin.createdAt" as "volleyballTeams[0].ronin.createdAt", "including_volleyballTeams[0]"."ronin.createdBy" as "volleyballTeams[0].ronin.createdBy", "including_volleyballTeams[0]"."ronin.updatedAt" as "volleyballTeams[0].ronin.updatedAt", "including_volleyballTeams[0]"."ronin.updatedBy" as "volleyballTeams[0].ronin.updatedBy", "including_volleyballTeams[0]{1}"."id" as "volleyballTeams[0]{1}.id", "including_volleyballTeams[0]{1}"."ronin.locked" as "volleyballTeams[0]{1}.ronin.locked", "including_volleyballTeams[0]{1}"."ronin.createdAt" as "volleyballTeams[0]{1}.ronin.createdAt", "including_volleyballTeams[0]{1}"."ronin.createdBy" as "volleyballTeams[0]{1}.ronin.createdBy", "including_volleyballTeams[0]{1}"."ronin.updatedAt" as "volleyballTeams[0]{1}.ronin.updatedAt", "including_volleyballTeams[0]{1}"."ronin.updatedBy" as "volleyballTeams[0]{1}.ronin.updatedBy", "including_volleyballTeams[0]{1}"."locations" as "volleyballTeams[0]{1}.locations", "including_visitors[0]"."id" as "visitors[0].id", "including_visitors[0]"."ronin.locked" as "visitors[0].ronin.locked", "including_visitors[0]"."ronin.createdAt" as "visitors[0].ronin.createdAt", "including_visitors[0]"."ronin.createdBy" as "visitors[0].ronin.createdBy", "including_visitors[0]"."ronin.updatedAt" as "visitors[0].ronin.updatedAt", "including_visitors[0]"."ronin.updatedBy" as "visitors[0].ronin.updatedBy", "including_visitors[0]{1}"."id" as "visitors[0]{1}.id", "including_visitors[0]{1}"."ronin.locked" as "visitors[0]{1}.ronin.locked", "including_visitors[0]{1}"."ronin.createdAt" as "visitors[0]{1}.ronin.createdAt", "including_visitors[0]{1}"."ronin.createdBy" as "visitors[0]{1}.ronin.createdBy", "including_visitors[0]{1}"."ronin.updatedAt" as "visitors[0]{1}.ronin.updatedAt", "including_visitors[0]{1}"."ronin.updatedBy" as "visitors[0]{1}.ronin.updatedBy", "including_visitors[0]{1}"."handle" as "visitors[0]{1}.handle", "including_visitors[0]{1}"."firstName" as "visitors[0]{1}.firstName" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_volleyball_teams" as "including_volleyballTeams[0]" ON ("including_volleyballTeams[0]"."source" = "sub_beaches"."id") LEFT JOIN "teams" as "including_volleyballTeams[0]{1}" ON ("including_volleyballTeams[0]{1}"."id" = "including_volleyballTeams[0]"."target")LEFT JOIN "ronin_link_beach_visitors" as "including_visitors[0]" ON ("including_visitors[0]"."source" = "sub_beaches"."id") LEFT JOIN "accounts" as "including_visitors[0]{1}" ON ("including_visitors[0]{1}"."id" = "including_visitors[0]"."target")`,
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
    visitors: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: expect.any(String),
      firstName: expect.any(String),
    }),
    volleyballTeams: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      locations: {
        europe: expect.any(String),
      },
    }),
  });
});

test('get single record including child records that are partially not found (one-to-many, defined manually, multiple fields)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beach: {
          using: ['visitors', 'soccerTeams'],
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        { slug: 'handle', type: 'string' },
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
    },
    {
      slug: 'team',
      fields: [{ slug: 'locations', type: 'json' }],
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
        {
          slug: 'soccerTeams',
          type: 'link',
          target: 'team',
          kind: 'many',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_beaches"."id", "sub_beaches"."ronin.locked", "sub_beaches"."ronin.createdAt", "sub_beaches"."ronin.createdBy", "sub_beaches"."ronin.updatedAt", "sub_beaches"."ronin.updatedBy", "including_soccerTeams[0]"."id" as "soccerTeams[0].id", "including_soccerTeams[0]"."ronin.locked" as "soccerTeams[0].ronin.locked", "including_soccerTeams[0]"."ronin.createdAt" as "soccerTeams[0].ronin.createdAt", "including_soccerTeams[0]"."ronin.createdBy" as "soccerTeams[0].ronin.createdBy", "including_soccerTeams[0]"."ronin.updatedAt" as "soccerTeams[0].ronin.updatedAt", "including_soccerTeams[0]"."ronin.updatedBy" as "soccerTeams[0].ronin.updatedBy", "including_soccerTeams[0]{1}"."id" as "soccerTeams[0]{1}.id", "including_soccerTeams[0]{1}"."ronin.locked" as "soccerTeams[0]{1}.ronin.locked", "including_soccerTeams[0]{1}"."ronin.createdAt" as "soccerTeams[0]{1}.ronin.createdAt", "including_soccerTeams[0]{1}"."ronin.createdBy" as "soccerTeams[0]{1}.ronin.createdBy", "including_soccerTeams[0]{1}"."ronin.updatedAt" as "soccerTeams[0]{1}.ronin.updatedAt", "including_soccerTeams[0]{1}"."ronin.updatedBy" as "soccerTeams[0]{1}.ronin.updatedBy", "including_soccerTeams[0]{1}"."locations" as "soccerTeams[0]{1}.locations", "including_visitors[0]"."id" as "visitors[0].id", "including_visitors[0]"."ronin.locked" as "visitors[0].ronin.locked", "including_visitors[0]"."ronin.createdAt" as "visitors[0].ronin.createdAt", "including_visitors[0]"."ronin.createdBy" as "visitors[0].ronin.createdBy", "including_visitors[0]"."ronin.updatedAt" as "visitors[0].ronin.updatedAt", "including_visitors[0]"."ronin.updatedBy" as "visitors[0].ronin.updatedBy", "including_visitors[0]{1}"."id" as "visitors[0]{1}.id", "including_visitors[0]{1}"."ronin.locked" as "visitors[0]{1}.ronin.locked", "including_visitors[0]{1}"."ronin.createdAt" as "visitors[0]{1}.ronin.createdAt", "including_visitors[0]{1}"."ronin.createdBy" as "visitors[0]{1}.ronin.createdBy", "including_visitors[0]{1}"."ronin.updatedAt" as "visitors[0]{1}.ronin.updatedAt", "including_visitors[0]{1}"."ronin.updatedBy" as "visitors[0]{1}.ronin.updatedBy", "including_visitors[0]{1}"."handle" as "visitors[0]{1}.handle", "including_visitors[0]{1}"."firstName" as "visitors[0]{1}.firstName" FROM (SELECT * FROM "beaches" LIMIT 1) as sub_beaches LEFT JOIN "ronin_link_beach_soccer_teams" as "including_soccerTeams[0]" ON ("including_soccerTeams[0]"."source" = "sub_beaches"."id") LEFT JOIN "teams" as "including_soccerTeams[0]{1}" ON ("including_soccerTeams[0]{1}"."id" = "including_soccerTeams[0]"."target")LEFT JOIN "ronin_link_beach_visitors" as "including_visitors[0]" ON ("including_visitors[0]"."source" = "sub_beaches"."id") LEFT JOIN "accounts" as "including_visitors[0]{1}" ON ("including_visitors[0]{1}"."id" = "including_visitors[0]"."target")`,
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
    visitors: new Array(2).fill({
      id: expect.stringMatching(RECORD_ID_REGEX),
      ronin: {
        locked: false,
        createdAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      handle: expect.any(String),
      firstName: expect.any(String),
    }),
    soccerTeams: [],
  });
});

test('get single record including child records (one-to-many, defined automatically)', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: { handle: 'elaine' },
          using: ['members'],
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
      statement: `SELECT "sub_accounts"."id", "sub_accounts"."ronin.locked", "sub_accounts"."ronin.createdAt", "sub_accounts"."ronin.createdBy", "sub_accounts"."ronin.updatedAt", "sub_accounts"."ronin.updatedBy", "sub_accounts"."handle", "including_members[0]"."id" as "members[0].id", "including_members[0]"."ronin.locked" as "members[0].ronin.locked", "including_members[0]"."ronin.createdAt" as "members[0].ronin.createdAt", "including_members[0]"."ronin.createdBy" as "members[0].ronin.createdBy", "including_members[0]"."ronin.updatedAt" as "members[0].ronin.updatedAt", "including_members[0]"."ronin.updatedBy" as "members[0].ronin.updatedBy", "including_members[0]"."account" as "members[0].account" FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as "including_members[0]" ON ("including_members[0]"."account" = "sub_accounts"."id") WHERE "sub_accounts"."handle" = ?1`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults)[0] as SingleRecordResult;

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
          using: {
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
