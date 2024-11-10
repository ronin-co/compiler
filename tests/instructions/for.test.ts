import { expect, test } from 'bun:test';
import { type Schema, compileQueries } from '@/src/index';
import type { Query } from '@/src/types/query';

import { RONIN_SCHEMA_SYMBOLS } from '@/src/utils/helpers';

test('get single record for pre-defined condition', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: {
            'active-member': 'acc_39h8fhe98hefah8',
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
      for: {
        'active-member': {
          space: {
            being: 'spa_m9h8oha94helaji',
          },
        },
      },
    },
  ];

  const statements = compileQueries(queries, schemas);

  expect(statements).toEqual([
    {
      statement:
        'SELECT * FROM "views" WHERE ("space" = ?1) LIMIT 1',
      params: ['spa_m9h8oha94helaji'],
      returning: true,
    },
  ]);
});

test('get single record for pre-defined condition containing sub query', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: {
            'active-member': 'acc_39h8fhe98hefah8',
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
      for: {
        'active-member': {
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

test('get single record for pre-defined field containing sub query', () => {
  const queries: Array<Query> = [
    {
      get: {
        view: {
          for: {
            'active-member': 'acc_39h8fhe98hefah8',
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
      for: {
        'active-member': {
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
