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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_accounts"."id", "sub_accounts"."ronin.locked", "sub_accounts"."ronin.createdAt", "sub_accounts"."ronin.createdBy", "sub_accounts"."ronin.updatedAt", "sub_accounts"."ronin.updatedBy", "including_members"."id" as "including_members.id", "including_members"."ronin.locked" as "including_members.ronin.locked", "including_members"."ronin.createdAt" as "including_members.ronin.createdAt", "including_members"."ronin.createdBy" as "including_members.ronin.createdBy", "including_members"."ronin.updatedAt" as "including_members.ronin.updatedAt", "including_members"."ronin.updatedBy" as "including_members.ronin.updatedBy", "including_members"."account" as "including_members.account" FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as including_members ON ("including_members"."account" = "sub_accounts"."id")`,
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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_products"."id", "sub_products"."ronin.locked", "sub_products"."ronin.createdAt", "sub_products"."ronin.createdBy", "sub_products"."ronin.updatedAt", "sub_products"."ronin.updatedBy", "sub_products"."name", "including_beaches"."id" as "including_beaches.id", "including_beaches"."ronin.locked" as "including_beaches.ronin.locked", "including_beaches"."ronin.createdAt" as "including_beaches.ronin.createdAt", "including_beaches"."ronin.createdBy" as "including_beaches.ronin.createdBy", "including_beaches"."ronin.updatedAt" as "including_beaches.ronin.updatedAt", "including_beaches"."ronin.updatedBy" as "including_beaches.ronin.updatedBy", "including_beaches"."name" as "including_beaches.name" FROM (SELECT * FROM "products" LIMIT 1) as sub_products CROSS JOIN "beaches" as including_beaches`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

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
    beaches: new Array(3).fill({
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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "products"."id", "products"."ronin.locked", "products"."ronin.createdAt", "products"."ronin.createdBy", "products"."ronin.updatedAt", "products"."ronin.updatedBy", "products"."name", "including_beach"."id" as "including_beach.id", "including_beach"."ronin.locked" as "including_beach.ronin.locked", "including_beach"."ronin.createdAt" as "including_beach.ronin.createdAt", "including_beach"."ronin.createdBy" as "including_beach.ronin.createdBy", "including_beach"."ronin.updatedAt" as "including_beach.ronin.updatedAt", "including_beach"."ronin.updatedBy" as "including_beach.ronin.updatedBy", "including_beach"."name" as "including_beach.name" FROM "products" CROSS JOIN (SELECT * FROM "beaches" ORDER BY "name" COLLATE NOCASE DESC LIMIT 1) as including_beach LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

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

  const transaction = new Transaction(queries, {
    models,
    expandColumns: true,
  });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT "sub_products"."id", "sub_products"."ronin.locked", "sub_products"."ronin.createdAt", "sub_products"."ronin.createdBy", "sub_products"."ronin.updatedAt", "sub_products"."ronin.updatedBy", "sub_products"."name", "including_beaches"."id" as "including_beaches.id", "including_beaches"."ronin.locked" as "including_beaches.ronin.locked", "including_beaches"."ronin.createdAt" as "including_beaches.ronin.createdAt", "including_beaches"."ronin.createdBy" as "including_beaches.ronin.createdBy", "including_beaches"."ronin.updatedAt" as "including_beaches.ronin.updatedAt", "including_beaches"."ronin.updatedBy" as "including_beaches.ronin.updatedBy", "including_beaches"."name" as "including_beaches.name" FROM (SELECT * FROM "products" LIMIT 1) as sub_products CROSS JOIN (SELECT * FROM "beaches" ORDER BY "name" COLLATE NOCASE DESC) as including_beaches`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

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
    ],
  });
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
