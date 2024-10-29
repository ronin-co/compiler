import { expect, test } from 'bun:test';
import { compileQueryInput } from '@/src/index';
import type { Query } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';

test('get single record with field being value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            being: 'elaine',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "accounts" WHERE ("handle" = ?1) LIMIT 1');
  expect(values).toMatchObject(['elaine']);
});

test('get single record with field not being value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            notBeing: 'elaine',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "accounts" WHERE ("handle" != ?1) LIMIT 1');
  expect(values).toMatchObject(['elaine']);
});

test('get single record with field not being empty', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            notBeing: null,
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" IS NOT NULL) LIMIT 1',
  );
  expect(values).toMatchObject([]);
});

test('get single record with field starting with value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            startingWith: 'el',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" LIKE ?1%) LIMIT 1',
  );
  expect(values).toMatchObject(['el']);
});

test('get single record with field not starting with value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            notStartingWith: 'el',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE ?1%) LIMIT 1',
  );
  expect(values).toMatchObject(['el']);
});

test('get single record with field ending with value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            endingWith: 'ne',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" LIKE %?1) LIMIT 1',
  );
  expect(values).toMatchObject(['ne']);
});

test('get single record with field not ending with value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            notEndingWith: 'ne',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE %?1) LIMIT 1',
  );
  expect(values).toMatchObject(['ne']);
});

test('get single record with field containing value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            containing: 'ain',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" LIKE %?1%) LIMIT 1',
  );
  expect(values).toMatchObject(['ain']);
});

test('get single record with field not containing value', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            notContaining: 'ain',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" NOT LIKE %?1%) LIMIT 1',
  );
  expect(values).toMatchObject(['ain']);
});

test('get single record with field greater than value', () => {
  const query: Query = {
    get: {
      product: {
        with: {
          position: {
            greaterThan: 5,
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'product',
      pluralSlug: 'products',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "products" WHERE ("position" > ?1) LIMIT 1');
  expect(values).toMatchObject([5]);
});

test('get single record with field greater or equal to value', () => {
  const query: Query = {
    get: {
      product: {
        with: {
          position: {
            greaterOrEqual: 5,
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'product',
      pluralSlug: 'products',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "products" WHERE ("position" >= ?1) LIMIT 1');
  expect(values).toMatchObject([5]);
});

test('get single record with field less than value', () => {
  const query: Query = {
    get: {
      product: {
        with: {
          position: {
            lessThan: 10,
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'product',
      pluralSlug: 'products',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "products" WHERE ("position" < ?1) LIMIT 1');
  expect(values).toMatchObject([10]);
});

test('get single record with field less or equal to value', () => {
  const query: Query = {
    get: {
      product: {
        with: {
          position: {
            lessOrEqual: 10,
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'product',
      pluralSlug: 'products',
      fields: [
        {
          slug: 'position',
          type: 'number',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "products" WHERE ("position" <= ?1) LIMIT 1');
  expect(values).toMatchObject([10]);
});

test('get single record with multiple fields being value', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" = ?1 AND "name" = ?2) LIMIT 1',
  );
  expect(values).toMatchObject(['elaine', 'Elaine']);
});

test('get single record with reference field', () => {
  const query: Query = {
    get: {
      member: {
        with: {
          account: {
            handle: 'elaine',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
    {
      slug: 'member',
      pluralSlug: 'members',
      fields: [
        {
          slug: 'account',
          type: 'reference',
          target: { pluralSlug: 'accounts' },
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "members" WHERE ("account" = (SELECT "id" FROM "accounts" WHERE ("handle" = ?1) LIMIT 1)) LIMIT 1',
  );
  expect(values).toMatchObject(['elaine']);
});

test('get single record with reference field and id', () => {
  const query: Query = {
    get: {
      member: {
        with: {
          account: {
            id: 'mem_zgoj3xav8tpcte1s',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
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
          target: { pluralSlug: 'accounts' },
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "members" WHERE ("account" = ?1) LIMIT 1');
  expect(values).toMatchObject(['mem_zgoj3xav8tpcte1s']);
});

test('get single record with reference field and id with condition', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [
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
          target: { pluralSlug: 'accounts' },
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "members" WHERE ("account" = ?1) LIMIT 1');
  expect(values).toMatchObject(['mem_zgoj3xav8tpcte1s']);
});

test('get single record with json field', () => {
  const query: Query = {
    get: {
      team: {
        with: {
          billing: {
            invoiceRecipient: 'receipts@ronin.co',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'team',
      pluralSlug: 'teams',
      fields: [
        {
          slug: 'billing',
          type: 'json',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "teams" WHERE (json_extract(billing, '$.invoiceRecipient') = ?1) LIMIT 1`,
  );
  expect(values).toMatchObject(['receipts@ronin.co']);
});

test('get single record with one of fields', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "email" = ?2) LIMIT 1',
  );
  expect(values).toMatchObject(['elaine', 'elaine@site.co']);
});

test('get single record with one of field conditions', () => {
  const query: Query = {
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
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "handle" = ?2) LIMIT 1',
  );
  expect(values).toMatchObject(['elaine', 'david']);
});

test('get single record with one of field values', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          handle: {
            being: ['elaine', 'david'],
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'handle',
          type: 'string',
        },
      ],
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    'SELECT * FROM "accounts" WHERE ("handle" = ?1 OR "handle" = ?2) LIMIT 1',
  );
  expect(values).toMatchObject(['elaine', 'david']);
});

test('get single record with one of field values in group', () => {
  const query: Query = {
    get: {
      team: {
        with: {
          billing: {
            currency: ['EUR', 'USD'],
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'team',
      pluralSlug: 'teams',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe(
    `SELECT * FROM "teams" WHERE ("billing.currency" = ?1 OR "billing.currency" = ?2) LIMIT 1`,
  );
  expect(values).toMatchObject(['EUR', 'USD']);
});

test('get single record with title identifier', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          titleIdentifier: {
            being: 'Elaine',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
      fields: [
        {
          slug: 'name',
          type: 'string',
        },
      ],
      identifiers: {
        title: 'name',
      },
    },
  ];

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "accounts" WHERE ("name" = ?1) LIMIT 1');
  expect(values).toMatchObject(['Elaine']);
});

test('get single record with slug identifier', () => {
  const query: Query = {
    get: {
      account: {
        with: {
          slugIdentifier: {
            being: 'elaine',
          },
        },
      },
    },
  };

  const schemas: Array<Schema> = [
    {
      slug: 'account',
      pluralSlug: 'accounts',
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

  const { readStatement, values } = compileQueryInput(query, schemas);

  expect(readStatement).toBe('SELECT * FROM "accounts" WHERE ("handle" = ?1) LIMIT 1');
  expect(values).toMatchObject(['elaine']);
});
