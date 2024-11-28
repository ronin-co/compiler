import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Row, Statement } from '@ronin/engine/types';

export const engine = new Engine({
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
