import { expect, test } from 'bun:test';
import { type Model, type Query, Transaction } from '@/src/index';

import {
  RECORD_ID_REGEX,
  RECORD_TIMESTAMP_REGEX,
  queryEphemeralDatabase,
} from '@/fixtures/utils';
import type { SingleRecordResult } from '@/src/types/result';
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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "products"."id", "products"."ronin.locked", "products"."ronin.createdAt", "products"."ronin.createdBy", "products"."ronin.updatedAt", "products"."ronin.updatedBy", "including_team"."id" as "including_team.id", "including_team"."ronin.locked" as "including_team.ronin.locked", "including_team"."ronin.createdAt" as "including_team.ronin.createdAt", "including_team"."ronin.createdBy" as "including_team.ronin.createdBy", "including_team"."ronin.updatedAt" as "including_team.ronin.updatedAt", "including_team"."ronin.updatedBy" as "including_team.ronin.updatedBy" FROM "products" CROSS JOIN (SELECT * FROM "teams" LIMIT 1) as including_team LIMIT 1`,
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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "members"."id", "members"."ronin.locked", "members"."ronin.createdAt", "members"."ronin.createdBy", "members"."ronin.updatedAt", "members"."ronin.updatedBy", "members"."account", "including_account"."firstName" as "including_account.firstName" FROM "members" LEFT JOIN "accounts" as including_account ON ("including_account"."id" = "members"."account") LIMIT 1`,
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
      firstName: expect.any(String),
    },
  });
});

test('get single record including unrelated records with filter', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: {
            teams: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  teams: {
                    with: {
                      handle: {
                        [QUERY_SYMBOLS.EXPRESSION]: `${QUERY_SYMBOLS.FIELD_PARENT}label`,
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

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM (SELECT * FROM "views" LIMIT 1) as sub_views LEFT JOIN "teams" as including_teams ON ("including_teams"."handle" = "sub_views"."label")`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including unrelated records without filter', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: {
            teams: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  teams: null,
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
      slug: 'view',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "views" CROSS JOIN "teams" as including_teams LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including unrelated ordered record', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: {
            team: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  team: {
                    orderedBy: {
                      descending: ['ronin.updatedAt'],
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
    },
    {
      slug: 'view',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "views" CROSS JOIN (SELECT * FROM "teams" ORDER BY "ronin.updatedAt" DESC LIMIT 1) as including_team LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including unrelated ordered records', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: {
            teams: {
              [QUERY_SYMBOLS.QUERY]: {
                get: {
                  teams: {
                    orderedBy: {
                      descending: ['ronin.updatedAt'],
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
    },
    {
      slug: 'view',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "views" CROSS JOIN (SELECT * FROM "teams" ORDER BY "ronin.updatedAt" DESC) as including_teams LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including ephemeral field', () => {
  const queries: Array<Query> = [
    {
      get: {
        space: {
          including: {
            name: 'Example Space',
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'space',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT *, ?1 as "name" FROM "spaces" LIMIT 1`,
      params: ['Example Space'],
      returning: true,
    },
  ]);
});

test('get single record including ephemeral field containing expression', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          including: {
            name: {
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
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT *, ("firstName" || ' ' || "lastName") as "name" FROM "accounts" LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including deeply nested ephemeral field', () => {
  const queries: Array<Query> = [
    {
      get: {
        space: {
          including: {
            invoice: {
              recipient: 'receipts@site.co',
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'space',
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT *, ?1 as "invoice.recipient" FROM "spaces" LIMIT 1`,
      params: ['receipts@site.co'],
      returning: true,
    },
  ]);
});
