import fixtureData from '@/fixtures/data.json';
import { type Model, type Query, ROOT_MODEL, Transaction } from '@/src/index';
import { convertToSnakeCase, getProperty, setProperty } from '@/src/utils/helpers';
import { type Database, Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { WasmDriver } from '@ronin/engine/drivers/wasm';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Row, Statement } from '@ronin/engine/types';

/** A regex for asserting RONIN record IDs. */
export const RECORD_ID_REGEX = /[a-z]{3}_[a-z0-9]{16}/;

/** A regex for asserting RONIN record timestamps. */
export const RECORD_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/;

/** A regex for asserting RONIN pagination cursors. */
export const PAGINATION_CURSOR_REGEX = /^(?:[a-zA-Z0-9_]+,)*[a-zA-Z0-9_]*\d{13}$/;

/**
 * Pre-fills the database with the provided models and their respective data.
 *
 * @param databaseName - The name of the database that should be pre-filled.
 * @param models - The models that should be inserted.
 *
 * @returns A promise that resolves when the database has been pre-filled.
 */
const prefillDatabase = async (database: Database, models: Array<Model>) => {
  const rootModelTransaction = new Transaction([{ create: { model: ROOT_MODEL } }]);

  const modelTransaction = new Transaction(
    models.map((model) => ({ create: { model } })),
  );

  const createdModels = modelTransaction.models;

  const dataQueries: Array<Query> = createdModels.flatMap(
    (createdModel): Array<Query> => {
      const fixtureSlug = convertToSnakeCase(
        createdModel.slug.replace('roninLink', ''),
      ) as keyof typeof fixtureData;
      const data = fixtureData[fixtureSlug] || [];

      const formattedData = data.map((row) => {
        let newRow: Record<string, unknown> = {};

        for (const field of createdModel.fields || []) {
          const match = getProperty(row, field.slug);
          if (typeof match === 'undefined') continue;
          newRow = setProperty(newRow, field.slug, match);
        }

        return newRow;
      });

      return formattedData.map((row): Query => {
        return { add: { [createdModel.slug]: { to: row } } };
      });
    },
  );

  const dataTransaction = new Transaction(dataQueries, { models: createdModels });

  const statements = [
    ...rootModelTransaction.statements,
    ...modelTransaction.statements,
    ...dataTransaction.statements,
  ];

  await database.query(statements);
};

const RAW_ENGINE = new Engine({
  resolvers: [(engine) => new MemoryResolver(engine)],
  driver: new WasmDriver(),
});

const NON_RAW_ENGINE = new Engine({
  resolvers: [(engine) => new MemoryResolver(engine)],
  driver: new BunDriver(),
});

/**
 * Queries an ephemeral test database with the provided SQL statements.
 *
 * @param models - The models that should be inserted into the database.
 * @param statements - The statements that should be executed.
 * @param raw - By default, the results are returned in a raw format, meaning in the same
 * format in which SQLite returns them (rows being arrays of values). If `raw` is set to
 * `false`, the rows are returned as objects, which simulates the behavior of drivers that
 * are incompatible of returning raw results.
 *
 * @returns A list of rows resulting from the executed statements.
 */
export const queryEphemeralDatabase = async (
  models: Array<Model>,
  statements: Array<Statement>,
  raw = true,
): Promise<Array<Array<Row>>> => {
  const engine = raw ? RAW_ENGINE : NON_RAW_ENGINE;

  const databaseId = Math.random().toString(36).substring(7);
  const database = await engine.createDatabase({ id: databaseId });

  await prefillDatabase(database, models);

  const results = await database.query(statements, raw ? { shape: 'values-only' } : {});
  const formattedResults = results.map((result) => result.rows);

  await engine.deleteDatabase({ id: databaseId });

  return formattedResults;
};
