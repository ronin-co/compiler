import { type Model, type Query, Transaction } from '@/src/index';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Row, Statement } from '@ronin/engine/types';
import fixtureData from './data.json';

const engine = new Engine({
  resolvers: [
    new MemoryResolver({
      driver: new BunDriver(),
    }),
  ],
});

/**
 * Pre-fills the database with the provided models and their respective data.
 *
 * @param databaseName - The name of the database that should be pre-filled.
 * @param models - The models that should be inserted.
 *
 * @returns A promise that resolves when the database has been pre-filled.
 */
const prefillDatabase = async (databaseName: string, models: Array<Model>) => {
  for (const model of models) {
    const query: Query = { create: { model } };
    const modelTransaction = new Transaction([query], { models });

    const updatedModel = modelTransaction.models.find((item) => {
      return item.slug === model.slug;
    }) as Model;

    const data = fixtureData[updatedModel.slug as keyof typeof fixtureData];
    if (!data) throw new Error(`No fixture data found for model "${updatedModel.name}"`);

    const formattedData = data.map((row) => {
      const newRow: Record<string, unknown> = {};

      for (const field of updatedModel.fields || []) {
        const match = (row as Record<string, unknown>)[field.slug];
        if (typeof match === 'undefined') continue;
        newRow[field.slug] = match;
      }

      return newRow;
    });

    const dataStatements = formattedData.map((row) => {
      const query: Query = { add: { [updatedModel.slug]: { to: row } } };
      const { statements } = new Transaction([query], { models });

      return statements[0];
    });

    await engine.queryDatabase(databaseName, [
      modelTransaction.statements[0],
      ...dataStatements,
    ]);
  }
};

/**
 * Queries an ephemeral test database with the provided SQL statements.
 *
 * @param models - The models that should be inserted into the database.
 * @param statements - The statements that should be executed.
 *
 * @returns A list of rows resulting from the executed statements.
 */
export const queryEphemeralDatabase = async (
  models: Array<Model>,
  statements: Array<Statement>,
): Promise<Array<Array<Row>>> => {
  const databaseName = Math.random().toString(36).substring(7);
  await engine.createDatabase(databaseName);

  await prefillDatabase(databaseName, models);

  const results = await engine.queryDatabase(databaseName, statements);
  const formattedResults = results.map((result) => result.rows);

  await engine.deleteDatabase(databaseName);

  return formattedResults;
};
