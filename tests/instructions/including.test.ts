import { expect, test } from 'bun:test';
import { type Model, type Query, compileQueries } from '@/src/index';

import { RONIN_MODEL_SYMBOLS } from '@/src/utils/helpers';

test('get single record including unrelated record without filter', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          including: {
            team: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
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
      slug: 'view',
    },
  ];

  const statements = compileQueries(queries, models);

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
          including: {
            team: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
                get: {
                  team: {
                    with: {
                      handle: {
                        [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT}label`,
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

  const statements = compileQueries(queries, models);

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
          including: {
            teams: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
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

  const statements = compileQueries(queries, models);

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
          including: {
            teams: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
                get: {
                  teams: {
                    with: {
                      handle: {
                        [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD_PARENT}label`,
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

  const statements = compileQueries(queries, models);

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
          including: {
            team: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
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

  const statements = compileQueries(queries, models);

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
          including: {
            teams: {
              [RONIN_MODEL_SYMBOLS.QUERY]: {
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

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
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

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
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
              [RONIN_MODEL_SYMBOLS.EXPRESSION]: `${RONIN_MODEL_SYMBOLS.FIELD}firstName || ' ' || ${RONIN_MODEL_SYMBOLS.FIELD}lastName`,
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

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
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

  const statements = compileQueries(queries, models);

  expect(statements).toEqual([
    {
      statement: `SELECT *, ?1 as "invoice.recipient" FROM "spaces" LIMIT 1`,
      params: ['receipts@site.co'],
      returning: true,
    },
  ]);
});
