import { expect, test } from 'bun:test';
import { queryEphemeralDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';
import type { SingleRecordResult } from '@/src/types/result';

test('get single record with field being value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              being: 'elaine',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" = ?1) LIMIT 1',
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('elaine');
});

test('get single record with field not being value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              notBeing: 'elaine',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" != ?1) LIMIT 1',
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).not.toBe('elaine');
});

test('get single record with field not being empty', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              notBeing: null,
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" IS NOT NULL) LIMIT 1',
      params: [],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).not.toBeNull();
});

test('get single record with field starting with value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              startingWith: 'el',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" LIKE ?1) LIMIT 1',
      params: ['el%'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toStartWith('el');
});

test('get single record with field not starting with value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              notStartingWith: 'el',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE ?1) LIMIT 1',
      params: ['el%'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).not.toStartWith('el');
});

test('get single record with field ending with value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              endingWith: 'ne',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" LIKE ?1) LIMIT 1',
      params: ['%ne'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toEndWith('ne');
});

test('get single record with field not ending with value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              notEndingWith: 'ne',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE ?1) LIMIT 1',
      params: ['%ne'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).not.toEndWith('ne');
});

test('get single record with field containing value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              containing: 'ain',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" LIKE ?1) LIMIT 1',
      params: ['%ain%'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toContain('ain');
});

test('get single record with field not containing value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              notContaining: 'ain',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE ?1) LIMIT 1',
      params: ['%ain%'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).not.toContain('ain');
});

test('get single record with field greater than value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              greaterThan: 1,
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
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
      statement: 'SELECT * FROM "products" WHERE ("position" > ?1) LIMIT 1',
      params: [1],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.position).toBeGreaterThan(1);
});

test('get single record with field greater or equal to value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              greaterOrEqual: 2,
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
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
      statement: 'SELECT * FROM "products" WHERE ("position" >= ?1) LIMIT 1',
      params: [2],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.position).toBeGreaterThanOrEqual(2);
});

test('get single record with field less than value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              lessThan: 3,
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
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
      statement: 'SELECT * FROM "products" WHERE ("position" < ?1) LIMIT 1',
      params: [3],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.position).toBeLessThan(3);
});

test('get single record with field less or equal to value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              lessOrEqual: 3,
            },
          },
        },
      },
    },
  ];

  const models: Array<Model> = [
    {
      slug: 'product',
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
      statement: 'SELECT * FROM "products" WHERE ("position" <= ?1) LIMIT 1',
      params: [3],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.position).toBeLessThanOrEqual(3);
});

test('get single record with multiple fields being value', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              being: 'elaine',
            },
            firstName: {
              being: 'Elaine',
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
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT * FROM "accounts" WHERE ("handle" = ?1 AND "firstName" = ?2) LIMIT 1',
      params: ['elaine', 'Elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('elaine');
  expect(result.record?.firstName).toBe('Elaine');
});

test('get single record with link field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: {
              handle: 'elaine',
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
          type: 'link',
          target: 'account',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement:
        'SELECT * FROM "members" WHERE ("account" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1)) LIMIT 1',
      params: ['elaine'],
      returning: true,
    },
  ]);

  const [[targetRecord], ...rawResults] = await queryEphemeralDatabase(models, [
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = 'elaine') LIMIT 1`,
      params: [],
    },
    ...transaction.statements,
  ]);

  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.account).toBe(targetRecord.id);
});

test('get single record with link field and id', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: {
              id: 'acc_39h8fhe98hefah9j',
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
          type: 'link',
          target: 'account',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "members" WHERE ("account" = ?1) LIMIT 1',
      params: ['acc_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.account).toBe('acc_39h8fhe98hefah9j');
});

test('get single record with link field and id with condition', async () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: {
              id: {
                being: 'acc_39h8fhe98hefah9j',
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
          type: 'link',
          target: 'account',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "members" WHERE ("account" = ?1) LIMIT 1',
      params: ['acc_39h8fhe98hefah9j'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.account).toBe('acc_39h8fhe98hefah9j');
});

test('get single record with json field', async () => {
  const queries: Array<Query> = [
    {
      get: {
        team: {
          with: {
            locations: {
              europe: 'berlin',
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "teams" WHERE (json_extract(locations, '$.europe') = ?1) LIMIT 1`,
      params: ['berlin'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.locations).toHaveProperty('europe', 'berlin');
});

test('get single record with one of fields', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: [
            {
              handle: 'elaine',
            },
            {
              firstName: 'David',
            },
          ],
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
        {
          slug: 'firstName',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "firstName" = ?2) LIMIT 1`,
      params: ['elaine', 'David'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(
    result.record?.handle === 'elaine' || result.record?.firstName === 'David',
  ).toBeTrue();
});

test('get single record with one of field conditions', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: [
              {
                being: 'elaine',
              },
              {
                being: 'david',
              },
            ],
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "handle" = ?2) LIMIT 1`,
      params: ['elaine', 'david'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toBeOneOf(['elaine', 'david']);
});

test('get single record with one of field values', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              being: ['elaine', 'david'],
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
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "handle" = ?2) LIMIT 1`,
      params: ['elaine', 'david'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toBeOneOf(['elaine', 'david']);
});

test('get single record with one of nested field values', async () => {
  const queries: Array<Query> = [
    {
      get: {
        team: {
          with: {
            billing: {
              currency: ['EUR', 'USD'],
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
          slug: 'billing.currency',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "teams" WHERE ("billing.currency" = ?1 OR "billing.currency" = ?2) LIMIT 1`,
      params: ['EUR', 'USD'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect((result.record?.billing as Record<string, unknown>).currency).toBeOneOf([
    'EUR',
    'USD',
  ]);
});

test('get single record with name identifier', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            nameIdentifier: {
              being: 'Elaine',
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
      identifiers: {
        name: 'firstName',
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("firstName" = ?1) LIMIT 1`,
      params: ['Elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.firstName).toBe('Elaine');
});

test('get single record with slug identifier', async () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            slugIdentifier: {
              being: 'elaine',
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
      identifiers: {
        slug: 'handle',
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = ?1) LIMIT 1`,
      params: ['elaine'],
      returning: true,
    },
  ]);

  const rawResults = await queryEphemeralDatabase(models, transaction.statements);
  const result = transaction.formatResults(rawResults, false)[0] as SingleRecordResult;

  expect(result.record?.handle).toBe('elaine');
});
