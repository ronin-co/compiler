import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

import { RONIN_SCHEMA_SYMBOLS, RoninError } from '@/src/utils/helpers';

test('get single record for preset', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: ['specificSpace'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
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
          type: 'reference',
          target: { slug: 'account' },
        },
        {
          slug: 'space',
          type: 'reference',
          target: { slug: 'space' },
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
          type: 'reference',
          target: { slug: 'space' },
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              space: {
                being: 'spa_m9h8oha94helaji',
              },
            },
          },
          slug: 'specificSpace',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: 'SELECT * FROM "views" WHERE ("space" = ?1) LIMIT 1',
      params: ['spa_m9h8oha94helaji'],
      returning: true,
    },
  ]);
});

test('get single record for preset containing field with condition', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: {
            activeMember: 'acc_39h8fhe98hefah8',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
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
          type: 'reference',
          target: { slug: 'account' },
        },
        {
          slug: 'space',
          type: 'reference',
          target: { slug: 'space' },
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
          type: 'reference',
          target: { slug: 'space' },
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              space: {
                notBeing: {
                  [RONIN_SCHEMA_SYMBOLS.QUERY]: {
                    get: {
                      member: {
                        with: { account: RONIN_SCHEMA_SYMBOLS.VALUE },
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'SELECT * FROM "views" WHERE ("space" != (SELECT "space" FROM "members" WHERE ("account" = ?1) ORDER BY "activeAt" DESC LIMIT 1)) LIMIT 1',
      params: ['acc_39h8fhe98hefah8'],
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
            activeMember: 'acc_39h8fhe98hefah8',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
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
          type: 'reference',
          target: { slug: 'account' },
        },
        {
          slug: 'space',
          type: 'reference',
          target: { slug: 'space' },
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
          type: 'reference',
          target: { slug: 'space' },
        },
      ],
      presets: [
        {
          instructions: {
            with: {
              space: {
                [RONIN_SCHEMA_SYMBOLS.QUERY]: {
                  get: {
                    member: {
                      with: { account: RONIN_SCHEMA_SYMBOLS.VALUE },
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'SELECT * FROM "views" WHERE ("space" = (SELECT "space" FROM "members" WHERE ("account" = ?1) ORDER BY "activeAt" DESC LIMIT 1)) LIMIT 1',
      params: ['acc_39h8fhe98hefah8'],
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
            account: 'acc_39h8fhe98hefah8',
          },
          for: ['specificSpace'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
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
          type: 'reference',
          target: { slug: 'account' },
        },
        {
          slug: 'space',
          type: 'reference',
          target: { slug: 'space' },
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'SELECT * FROM "members" WHERE ("space" = ?1 AND "account" = ?2) LIMIT 1',
      params: ['spa_m9h8oha94helaji', 'acc_39h8fhe98hefah8'],
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

  const schemas: Array<Schema> = [
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
          type: 'reference',
          target: { slug: 'account' },
        },
        {
          slug: 'space',
          type: 'reference',
          target: { slug: 'space' },
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

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: 'SELECT "space", "account" FROM "members" LIMIT 1',
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including parent record (many-to-one)', () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          for: ['account'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'reference',
          target: { slug: 'account' },
          kind: 'one',
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "members" LEFT JOIN "accounts" as including_account ON ("including_account"."id" = "members"."account") LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including child records (one-to-many, defined manually)', () => {
  const queries: Array<Query> = [
    {
      get: {
        post: {
          for: ['comments'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'post',
      fields: [
        {
          slug: 'comments',
          type: 'reference',
          target: { slug: 'comment' },
          kind: 'many',
        },
      ],
    },
    {
      slug: 'comment',
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM (SELECT * FROM "posts" LIMIT 1) as sub_posts LEFT JOIN "ronin_post_comments" as including_comments ON ("including_comments"."id" = "sub_posts"."comments")`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including child records (one-to-many, defined automatically)', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          for: ['members'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
      fields: [
        {
          slug: 'account',
          type: 'reference',
          target: { slug: 'account' },
        },
      ],
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM (SELECT * FROM "accounts" LIMIT 1) as sub_accounts LEFT JOIN "members" as including_members ON ("including_members"."account" = "sub_accounts"."id")`,
      params: [],
      returning: true,
    },
  ]);
});

test('try get single record with non-existing preset', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          for: {
            activeMember: 'acc_39h8fhe98hefah8',
          },
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'account',
    },
    {
      slug: 'member',
    },
  ];

  let error: Error | undefined;

  try {
    compileQueries(queries, schemas);
  } catch (err) {
    error = err as Error;
  }

  expect(error).toBeInstanceOf(RoninError);
  expect(error).toHaveProperty(
    'message',
    'Preset "activeMember" does not exist in schema "Account".',
  );
  expect(error).toHaveProperty('code', 'PRESET_NOT_FOUND');
});
