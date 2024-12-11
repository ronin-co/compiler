import { expect, test } from 'bun:test';
import { RECORD_TIMESTAMP_REGEX, queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { MultipleRecordResult } from '@/src/types/result';
import { RoninError } from '@/src/utils/helpers';
import { CURSOR_NULL_PLACEHOLDER } from '@/src/utils/pagination';

test('get multiple records before cursor', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: '1733654878079',
          limitedTo: 2,
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "beaches" WHERE (("ronin.createdAt" > '2024-12-08T10:47:58.079Z')) ORDER BY "ronin.createdAt" DESC LIMIT 3`,
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as MultipleRecordResult;

  const firstRecordTime = new Date('2024-12-10T10:47:58.079Z');
  const lastRecordTime = new Date('2024-12-09T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah9j',
      ronin: {
        locked: false,
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Manly',
    },
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        locked: false,
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
    },
  ]);

  expect(result.moreBefore).toBe(firstRecordTime.getTime().toString());
  expect(result.moreAfter).toBe(lastRecordTime.getTime().toString());
});

test('get multiple records before cursor ordered by string field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        beaches: {
          before: 'Manly,1733827678079',
          orderedBy: {
            ascending: ['name'],
          },
          limitedTo: 2,
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "beaches" WHERE ((IFNULL("name", -1e999) < ?1 COLLATE NOCASE) OR ("name" = ?1 AND ("ronin.createdAt" > '2024-12-10T10:47:58.079Z'))) ORDER BY "name" COLLATE NOCASE ASC, "ronin.createdAt" DESC LIMIT 3`,
      params: ['Manly'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as MultipleRecordResult;

  const firstRecordName = 'Coogee';
  const firstRecordTime = new Date('2024-12-09T10:47:58.079Z');

  const lastRecordName = 'Cronulla';
  const lastRecordTime = new Date('2024-12-08T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'bea_39h8fhe98hefah0j',
      ronin: {
        locked: false,
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: 'Coogee',
    },
    {
      id: 'bea_39h8fhe98hefah1j',
      ronin: {
        locked: false,
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      name: lastRecordName,
    },
  ]);

  expect(result.moreBefore).toBe(`${firstRecordName},${firstRecordTime.getTime()}`);
  expect(result.moreAfter).toBe(`${lastRecordName},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by boolean field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        members: {
          before: 'true,1728470878079',
          orderedBy: {
            ascending: ['pending'],
          },
          limitedTo: 2,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'member',
      fields: [
        {
          slug: 'pending',
          type: 'boolean',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "members" WHERE ((IFNULL("pending", -1e999) < ?1) OR ("pending" = ?1 AND ("ronin.createdAt" > '2024-10-09T10:47:58.079Z'))) ORDER BY "pending" ASC, "ronin.createdAt" DESC LIMIT 3`,
      params: [1],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as MultipleRecordResult;

  const firstRecordPending = false;
  const firstRecordTime = new Date('2024-11-10T10:47:58.079Z');

  const lastRecordPending = true;
  const lastRecordTime = new Date('2024-12-11T10:47:58.079Z');

  expect(result.records).toEqual([
    {
      id: 'mem_39h8fhe98hefah9j',
      ronin: {
        locked: false,
        createdAt: firstRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      pending: firstRecordPending,
    },
    {
      id: 'mem_39h8fhe98hefah8j',
      ronin: {
        locked: false,
        createdAt: lastRecordTime.toISOString(),
        createdBy: null,
        updatedAt: expect.stringMatching(RECORD_TIMESTAMP_REGEX),
        updatedBy: null,
      },
      pending: lastRecordPending,
    },
  ]);

  expect(result.moreBefore).toBeUndefined();
  expect(result.moreAfter).toBe(`${lastRecordPending},${lastRecordTime.getTime()}`);
});

test('get multiple records before cursor ordered by number field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '2,1667575193779',
          orderedBy: {
            ascending: ['position'],
          },
          limitedTo: 100,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ((IFNULL("position", -1e999) < ?1) OR ("position" = ?1 AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "position" ASC, "ronin.createdAt" DESC LIMIT 101`,
      params: [2],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by empty string field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
          orderedBy: {
            descending: ['handle'],
          },
          limitedTo: 100,
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("handle" IS NOT NULL) OR ("handle" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "handle" COLLATE NOCASE DESC, "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by empty boolean field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
          orderedBy: {
            descending: ['active'],
          },
          limitedTo: 100,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'active',
          type: 'boolean',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("active" IS NOT NULL) OR ("active" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "active" DESC, "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor ordered by empty number field', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: `${CURSOR_NULL_PLACEHOLDER},1667575193779`,
          orderedBy: {
            descending: ['position'],
          },
          limitedTo: 100,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("position" IS NOT NULL) OR ("position" IS NULL AND ("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "position" DESC, "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('get multiple records before cursor while filtering', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          with: {
            email: null,
          },
          before: '1667575193779',
          limitedTo: 100,
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
      fields: [
        {
          slug: 'email',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE (("email" IS NULL) AND (("ronin.createdAt" > '2022-11-04T15:19:53.779Z'))) ORDER BY "ronin.createdAt" DESC LIMIT 101`,
      params: [],
      returning: true,
    },
  ]);
});

test('try to paginate without providing page size', () => {
  const queries: Array<Query> = [
    {
      get: {
        accounts: {
          before: '1667575193779',
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'account',
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
    'When providing a pagination cursor in the `before` or `after` instruction, a `limitedTo` instruction must be provided as well, to define the page size.',
  );
  expect(error).toHaveProperty('code', 'MISSING_INSTRUCTION');
});
