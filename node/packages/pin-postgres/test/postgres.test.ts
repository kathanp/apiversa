import { describe, expect, it } from 'vitest';
import { postgresPins, type PgPinClient } from '../src/index.js';

describe('postgres pins', () => {
  it('reads and writes through the host pool and does not connect', async () => {
    const rows = new Map<string, string>();
    const sql: string[] = [];
    const client: PgPinClient = {
      async query(text, values) {
        sql.push(text);
        if (text.startsWith('select')) return { rows: rows.has(String(values[0])) ? [{ pinned_version: rows.get(String(values[0])) }] : [] };
        rows.set(String(values[0]), String(values[1]));
        return { rows: [] };
      },
    };
    const pins = postgresPins(client);
    expect(await pins.get('partner-a')).toBeUndefined();
    await pins.set('partner-a', '2026-01-15');
    expect(await pins.get('partner-a')).toBe('2026-01-15');
    expect(pins.migration()).toContain('apiversa_pin');
    expect(sql.join('\n')).not.toMatch(/https?:/);
  });
});
