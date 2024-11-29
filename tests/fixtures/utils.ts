import { type Model, type Query, Transaction } from '@/src/index';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Row, Statement } from '@ronin/engine/types';
import fixtureData from './data.json';

export const engine = new Engine({
  resolvers: [
    new MemoryResolver({
      driver: new BunDriver(),
    }),
  ],
});

export const prepareDatabase = async (databaseName: string, models: Array<Model>) => {
  for (const model of models) {
    const query: Query = { create: { model } };
    const { statements: modelStatements } = new Transaction([query], {
      models,
      inlineParams: true,
    });

    const data = fixtureData[model.slug as keyof typeof fixtureData];
    if (!data) throw new Error(`No fixture data found for model "${model.slug}"`);

    const formattedData = data.map((row) => {
      const newRow: Record<string, unknown> = {};

      for (const field of model.fields || []) {
        const match = (row as Record<string, unknown>)[field.slug];
        if (typeof match === 'undefined') continue;
        newRow[field.slug] = match;
      }

      return newRow;
    });

    const dataStatements = formattedData.map((row) => {
      const query: Query = { add: { [model.slug]: { to: row } } };
      const { statements } = new Transaction([query], {
        models,
        inlineParams: true,
      });
      return statements[0];
    });

    await engine.queryDatabase(databaseName, [modelStatements[0], ...dataStatements]);
  }
};

export const queryDatabase = async (
  models: Array<Model>,
  statements: Array<Statement>,
): Promise<Array<Array<Row>>> => {
  const databaseName = Math.random().toString(36).substring(7);
  await engine.createDatabase(databaseName);

  await prepareDatabase(databaseName, models);

  const results = await engine.queryDatabase(databaseName, statements);
  const formattedResults = results.map((result) => result.rows);

  await engine.deleteDatabase(databaseName);

  return formattedResults;
};
