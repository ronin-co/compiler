import { expect, test } from 'bun:test';
import { compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import { RONIN_SCHEMA_SYMBOLS } from '@/src/utils';

test('get single record for pre-defined condition', () => {
  const query: Query = {
    get: {
      views: {
        for: {
          'active-member': 'acc_39h8fhe98hefah8',
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'space',
      pluralSlug: 'spaces',
    },
    {
      slug: 'account',
      pluralSlug: 'accounts',
    },
    {
      slug: 'member',
      pluralSlug: 'members',
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
      pluralSlug: 'views',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "views" WHERE ("space" = ?1) ORDER BY "ronin.createdAt" DESC LIMIT 101',
  );
  expect(values).toMatchObject(['spa_m9h8oha94helaji']);
});

test('get single record for pre-defined condition containing sub query', () => {
  const query: Query = {
    get: {
      views: {
        for: {
          'active-member': 'acc_39h8fhe98hefah8',
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'space',
      pluralSlug: 'spaces',
    },
    {
      slug: 'account',
      pluralSlug: 'accounts',
    },
    {
      slug: 'member',
      pluralSlug: 'members',
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
      pluralSlug: 'views',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "views" WHERE ("space" != (SELECT "space" FROM "members" WHERE ("account" = ?1) ORDER BY "activeAt" DESC LIMIT 1)) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject(['acc_39h8fhe98hefah8']);
});

test('get single record for pre-defined field containing sub query', () => {
  const query: Query = {
    get: {
      views: {
        for: {
          'active-member': 'acc_39h8fhe98hefah8',
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'space',
      pluralSlug: 'spaces',
    },
    {
      slug: 'account',
      pluralSlug: 'accounts',
    },
    {
      slug: 'member',
      pluralSlug: 'members',
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
      pluralSlug: 'views',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "views" WHERE ("space" = (SELECT "space" FROM "members" WHERE ("account" = ?1) ORDER BY "activeAt" DESC LIMIT 1)) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
  );
  expect(values).toMatchObject(['acc_39h8fhe98hefah8']);
});
