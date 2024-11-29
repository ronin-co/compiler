import { afterEach, beforeEach } from 'bun:test';
import { engine } from '@/fixtures/utils';

beforeEach(async () => {
  await engine.createDatabase('test');
});

afterEach(async () => {
  await engine.deleteDatabase('test');
});
