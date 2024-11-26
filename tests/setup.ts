import { afterEach, beforeEach } from 'bun:test';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';

const engine = new Engine({
  resolvers: [
    new MemoryResolver({
      driver: new BunDriver(),
    }),
  ],
});

beforeEach(async () => {
  await engine.createDatabase('test');
});

afterEach(async () => {
  await engine.deleteDatabase('test');
});
