# RONIN Compiler

[![code coverage](https://img.shields.io/codecov/c/github/ronin-co/compiler)](https://codecov.io/github/ronin-co/compiler)
[![install size](https://packagephobia.com/badge?p=@ronin/compiler)](https://packagephobia.com/result?p=@ronin/compiler)
[![tests](https://img.shields.io/github/actions/workflow/status/ronin-co/compiler/validate.yml?label=tests)](https://github.com/ronin-co/compiler/actions/workflows/validate.yml)

This package compiles [RONIN queries](https://ronin.co/docs/queries) to [SQLite](https://www.sqlite.org) statements.

## Setup

You don't need to install this package explicitly, as it is already included in the [RONIN client](https://github.com/ronin-co/client).

However, we would be excited to welcome your feature suggestions or bug fixes for the RONIN compiler. Read on to learn more about how to suggest changes.

## Contributing

To start contributing code, first make sure you have [Bun](https://bun.sh) installed, which is a JavaScript runtime.

Next, [clone the repo](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) and install its dependencies:

```bash
bun install
```

Once that's done, link the package to make it available to all of your local projects:

```bash
bun link
```

Inside your project, you can then run the following command, which is similar to `bun add @ronin/compiler` or `npm install @ronin/compiler`, except that it doesn't install `@ronin/compiler` from npm, but instead uses your local clone of the package:

```bash
bun link @ronin/compiler
```

If your project is not yet compatible with [Bun](https://bun.sh), feel free to replace all of the occurrences of the word `bun` in the commands above with `npm` instead.

You will just need to make sure that, once you [create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request#creating-the-pull-request) on the current repo, it will not contain a `package-lock.json` file, which is usually generated by npm. Instead, we're using the `bun.lockb` file for this purpose (locking sub dependencies to a certain version).

### Developing

The programmatic API of the RONIN compiler looks like this:

```typescript
import { Transaction } from '@ronin/compiler';

const transaction = new Transaction([
  {
    create: { model: { slug: 'account' } }
  },
  {
    get: { accounts: null }
  }
]);

transaction.statements;
// [{
//   statement: 'CREATE TABLE "accounts" ...',
//   params: []
// }, {
//   statement: 'SELECT * FROM "accounts"',
//   params: [],
//   returning: true,
// }]
```

Once the RONIN queries have been compiled down to SQL statements, the statements can be
executed and their results can be formatted by the compiler as well:

```typescript
// Passing `rawResults` (rows being arrays of values) provided by the database (ideal)
const results: Array<Result> = transaction.formatResults(rawResults);

// Passing `objectResults` (rows being objects) provided by a driver
const results: Array<Result> = transaction.formatResults(objectResults, false);
```

#### Root Model

Before you can run any statements generated by the compiler that are altering the database schema, you need to create the table of the so-called "root model", which is used to store metadata for all other models.

This table is called `ronin_schema`, which mimics the default `sqlite_schema` table provided by SQLite. You can generate its respective SQL statements like this:

```typescript
import { Transaction, ROOT_MODEL } from '@ronin/compiler';

const transaction = new Transaction([
  {
    create: { model: ROOT_MODEL }
  }
]);
```

Afterward, run the statements located in `transaction.statements` to create the table for the root model. Once that is done, your database is prepared to run any statements generated by the compiler.

#### Types

In total, the following types are being exported:

```typescript
import type {
  Query,

  Model,
  ModelField,
  ModelIndex,
  ModelTrigger,
  ModelPreset,

  Statement,
  Result
} from '@ronin/compiler';
```

#### Options

To fine-tune the behavior of the compiler, you can pass the following options:

```typescript
new Transaction(queries, {
  // A list of models that already existing inside the database.
  models: [
    { slug: 'account' }
  ],

  // Instead of returning an array of parameters for every statement (which allows for
  // preventing SQL injections), all parameters are inlined directly into the SQL strings.
  // This option should only be used if the generated SQL will be manually verified.
  inlineParams: true,

  // By default, in the generated SQL statements, the compiler does not alias columns if
  // multiple different tables with the same column names are being joined. Only the table
  // names themselves are aliased.
  //
  // This ensures the cleanest possible SQL statements in conjunction with the default
  // behavior of SQL databases, where the result of a statement is a list (array) of
  // values, which are inherently not prone to conflicts.
  //
  // If the driver being used instead returns an object for every row, the driver must
  // ensure the uniqueness of every key in that object, which means prefixing duplicated
  // column names with the name of the respective table, if multiple tables are joined
  // (example for an object key: "table_name.column_name").
  //
  // Drivers that return objects for rows offer this behavior as an option that is
  // usually called "expand columns". If the driver being used does not offer such an
  // option, you can instead activate the option in the compiler, which results in longer
  // SQL statements because all column names are aliased.
  expandColumns: true
});
```

#### Transpilation

In order to be compatible with a wide range of projects, the source code of the `compiler` repo needs to be compiled (transpiled) whenever you make changes to it. To automate this, you can keep this command running in your terminal:

```bash
bun run dev
```

Whenever you make a change to the source code, it will then automatically be transpiled again.

### Architecture

The interface of creating new `Transaction` instances (thereby creating new transactions) was chosen in order to define the smallest workload unit that the compiler can operate on.

Just like for the database, a transaction for the compiler defines an [atomic operation](https://www.sqlite.org/lang_transaction.html) in which a list of queries can be executed serially, and where each query can rely on the changes made by a previous one. In order to facilitate this, a programmatic interface that clarifies the accumulation of in-memory state is required (class instances).

For example, if one query creates a new model, every query after it within the same transaction must be able to interact with the records of that model, or update the model itself, without roundtrips to the database, thereby requiring the accumulation of state while the transaction is being compiled.

Furthermore, since every database transaction causes a [lock](https://www.sqlite.org/lockingv3.html), the database is inherently not locked between the execution of multiple transactions, which could cause the compilation inputs (e.g. models) of a `Transaction` to no longer be up-to-date. If the inputs have changed, a `new Transaction` should therefore be created.

### Running Tests

The RONIN compiler has 100% test coverage, which means that every single line of code is tested automatically, to ensure that any change to the source code doesn't cause a regression.

Before you create a pull request on the `compiler` repo, it is therefore advised to run those tests in order to ensure everything works as expected:

```bash
# Run all tests
bun test

# Alternatively, run a single test
bun test -t 'your test name'
```
