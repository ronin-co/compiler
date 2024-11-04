# RONIN Compiler

This package compiles RONIN queries to SQL statements.

## Usage

```typescript
import { compileQueryInput } from '@ronin/compiler';

const query = {
  get: {
    accounts: null,
  },
};

const schemas = [
  {
    slug: 'account',
  },
];

const { writeStatements, readStatement } = compileQueryInput(query, schemas);

console.log(readStatement);
// SELECT * FROM "accounts" ORDER BY "ronin.createdAt" DESC LIMIT 101
```

## Testing

Use the following command to run the test suite:

```
bun test
```
