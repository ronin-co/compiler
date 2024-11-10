import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

import { RONIN_SCHEMA_SYMBOLS } from '@/src/utils/helpers';

test('get single record including parent record (many-to-one)', () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          including: ['account'],
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
          including: ['comments'],
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
          including: ['members'],
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

test('get single record including unrelated record without filter', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: ['team'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
    {
      slug: 'view',
      including: {
        team: {
          get: {
            team: null,
          },
        },
      },
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "views" CROSS JOIN (SELECT * FROM "teams" LIMIT 1) as including_team LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including unrelated record with filter', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: ['team'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
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
      including: {
        team: {
          get: {
            team: {
              with: {
                handle: `${RONIN_SCHEMA_SYMBOLS.FIELD}label`,
              },
            },
          },
        },
      },
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "views" LEFT JOIN "teams" as including_team ON ("including_team"."handle" = "views"."label") LIMIT 1`,
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
          including: ['teams'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
    {
      slug: 'view',
      including: {
        teams: {
          get: {
            teams: null,
          },
        },
      },
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "views" CROSS JOIN "teams" as including_teams LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});

test('get single record including unrelated records with filter', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: ['teams'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
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
      including: {
        teams: {
          get: {
            teams: {
              with: {
                handle: `${RONIN_SCHEMA_SYMBOLS.FIELD}label`,
              },
            },
          },
        },
      },
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM (SELECT * FROM "views" LIMIT 1) as sub_views LEFT JOIN "teams" as including_teams ON ("including_teams"."handle" = "sub_views"."label")`,
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
          including: ['team'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
    {
      slug: 'view',
      including: {
        team: {
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
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
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
          including: ['teams'],
        },
      },
    },
  ];

  const schemas: Array<Schema> = [
    {
      slug: 'team',
    },
    {
      slug: 'view',
      including: {
        teams: {
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
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement: `SELECT * FROM "views" CROSS JOIN (SELECT * FROM "teams" ORDER BY "ronin.updatedAt" DESC) as including_teams LIMIT 1`,
      params: [],
      returning: true,
    },
  ]);
});
