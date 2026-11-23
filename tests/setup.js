import { beforeEach, vi } from 'vitest';

const FIXED_NOW = new Date('2026-11-22T12:00:00.000Z');

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(FIXED_NOW);

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
