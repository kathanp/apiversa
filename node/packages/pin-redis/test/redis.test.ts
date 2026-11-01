import { describe, expect, it } from 'vitest';
import { redisPins } from '../src/index.js';

describe('redis pin store', () => {
  it('reads and writes a pin through the host client', async () => {
    const saved = new Map<string, string>();
    const pins = redisPins({
      get: async (key) => saved.get(key) ?? null,
      set: async (key, value) => {
        saved.set(key, value);
      },
    });
    expect(await pins.get('partner-a')).toBeUndefined();
    await pins.set('partner-a', '2026-01-15');
    expect(await pins.get('partner-a')).toBe('2026-01-15');
    expect(saved.get('apiversa:pin:partner-a')).toBe('2026-01-15');
  });
});
