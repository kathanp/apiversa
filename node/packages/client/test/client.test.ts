import { describe, expect, it } from 'vitest';
import { createClient } from '../src/index.js';

describe('typed client', () => {
  it('sends the pinned version and does not call the network itself', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const client = createClient({
      baseUrl: 'https://api.example',
      version: '2026-01-15',
      fetch: async (url, init) => {
        seen.push({ url, headers: init.headers });
        return { status: 200, json: async () => ({ ok: true }) };
      },
    });
    const result = await client.request('/hotels');
    expect(result.body).toEqual({ ok: true });
    expect(seen[0]?.headers['Api-Version']).toBe('2026-01-15');
    expect(seen[0]?.url).toBe('https://api.example/hotels');
  });
});
