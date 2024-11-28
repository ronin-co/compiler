import { expect, test } from 'bun:test';
import { queryDatabase } from '@/fixtures/utils';
import { type Model, type Query, Transaction } from '@/src/index';

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

  const rows = await queryDatabase(transaction.statements);

  expect(transaction.formatOutput(rows)[0]).toHaveProperty('record.handle', 'elaine');
});

test('get single record with field not being value', () => {
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
});

test('get single record with field not being empty', () => {
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
});

test('get single record with field starting with value', () => {
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
      statement: 'SELECT * FROM "accounts" WHERE ("handle" LIKE ?1%) LIMIT 1',
      params: ['el'],
      returning: true,
    },
  ]);
});

test('get single record with field not starting with value', () => {
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
      statement: 'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE ?1%) LIMIT 1',
      params: ['el'],
      returning: true,
    },
  ]);
});

test('get single record with field ending with value', () => {
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
      statement: 'SELECT * FROM "accounts" WHERE ("handle" LIKE %?1) LIMIT 1',
      params: ['ne'],
      returning: true,
    },
  ]);
});

test('get single record with field not ending with value', () => {
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
      statement: 'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE %?1) LIMIT 1',
      params: ['ne'],
      returning: true,
    },
  ]);
});

test('get single record with field containing value', () => {
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
      statement: 'SELECT * FROM "accounts" WHERE ("handle" LIKE %?1%) LIMIT 1',
      params: ['ain'],
      returning: true,
    },
  ]);
});

test('get single record with field not containing value', () => {
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
      statement: 'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE %?1%) LIMIT 1',
      params: ['ain'],
      returning: true,
    },
  ]);
});

test('get single record with field greater than value', () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              greaterThan: 5,
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
      params: [5],
      returning: true,
    },
  ]);
});

test('get single record with field greater or equal to value', () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              greaterOrEqual: 5,
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
      params: [5],
      returning: true,
    },
  ]);
});

test('get single record with field less than value', () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              lessThan: 10,
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
      params: [10],
      returning: true,
    },
  ]);
});

test('get single record with field less or equal to value', () => {
  const queries: Array<Query> = [
    {
      get: {
        product: {
          with: {
            position: {
              lessOrEqual: 10,
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
      params: [10],
      returning: true,
    },
  ]);
});

test('get single record with multiple fields being value', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: {
            handle: {
              being: 'elaine',
            },
            name: {
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
          slug: 'name',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: 'SELECT * FROM "accounts" WHERE ("handle" = ?1 AND "name" = ?2) LIMIT 1',
      params: ['elaine', 'Elaine'],
      returning: true,
    },
  ]);
});

test('get single record with link field', () => {
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
});

test('get single record with link field and id', () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: {
              id: 'mem_zgoj3xav8tpcte1s',
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
      params: ['mem_zgoj3xav8tpcte1s'],
      returning: true,
    },
  ]);
});

test('get single record with link field and id with condition', () => {
  const queries: Array<Query> = [
    {
      get: {
        member: {
          with: {
            account: {
              id: {
                being: 'mem_zgoj3xav8tpcte1s',
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
      params: ['mem_zgoj3xav8tpcte1s'],
      returning: true,
    },
  ]);
});

test('get single record with json field', () => {
  const queries: Array<Query> = [
    {
      get: {
        team: {
          with: {
            billing: {
              invoiceRecipient: 'receipts@ronin.co',
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
          slug: 'billing',
          type: 'json',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "teams" WHERE (json_extract(billing, '$.invoiceRecipient') = ?1) LIMIT 1`,
      params: ['receipts@ronin.co'],
      returning: true,
    },
  ]);
});

test('get single record with one of fields', () => {
  const queries: Array<Query> = [
    {
      get: {
        account: {
          with: [
            {
              handle: 'elaine',
            },
            {
              email: 'elaine@site.co',
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
          slug: 'email',
          type: 'string',
        },
      ],
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "email" = ?2) LIMIT 1`,
      params: ['elaine', 'elaine@site.co'],
      returning: true,
    },
  ]);
});

test('get single record with one of field conditions', () => {
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
});

test('get single record with one of field values', () => {
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
});

test('get single record with one of field values in group', () => {
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
          slug: 'billing',
          type: 'group',
        },
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
});

test('get single record with name identifier', () => {
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
          slug: 'name',
          type: 'string',
        },
      ],
      identifiers: {
        name: 'name',
      },
    },
  ];

  const transaction = new Transaction(queries, { models });

  expect(transaction.statements).toEqual([
    {
      statement: `SELECT * FROM "accounts" WHERE ("name" = ?1) LIMIT 1`,
      params: ['Elaine'],
      returning: true,
    },
  ]);
});

test('get single record with slug identifier', () => {
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
});
