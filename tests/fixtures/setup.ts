import { afterEach, beforeEach } from 'bun:test';
import path from 'node:path';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Row, Statement } from '@ronin/engine/types';

const engine = new Engine({
  resolvers: [
    new MemoryResolver({
      driver: new BunDriver(),
    }),
  ],
});

export const queryDatabase = async (
  statements: Array<Statement>,
): Promise<Array<Array<Row>>> => {
  const results = await engine.queryDatabase('test', statements);
  return results.map((result) => result.rows);
};

beforeEach(async () => {
  await engine.createDatabase('test');

  const fixtureFile = Bun.file(path.join(__dirname, 'database.sql'));
  const fixtureContent = await fixtureFile.text();

  const statementStrings = fixtureContent
    .split(';')
    .filter(Boolean)
    .map((statement) => statement.replaceAll('\n', ''));
  const statements = statementStrings.map((statement) => ({ statement, params: [] }));

  await engine.queryDatabase('test', statements);
});

afterEach(async () => {
  await engine.deleteDatabase('test');
});
