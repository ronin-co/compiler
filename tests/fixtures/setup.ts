import { afterEach, beforeEach } from 'bun:test';
import path from 'node:path';
import { engine, queryDatabase } from '@/fixtures/utils';

beforeEach(async () => {
  await engine.createDatabase('test');

  const fixtureFile = Bun.file(path.join(__dirname, 'database.sql'));
  const fixtureContent = await fixtureFile.text();

  const statementStrings = fixtureContent
    .split(';')
    .filter(Boolean)
    .map((statement) => statement.replaceAll('\n', ''));
  const statements = statementStrings.map((statement) => ({ statement, params: [] }));

  await queryDatabase(statements);
});

afterEach(async () => {
  await engine.deleteDatabase('test');
});
