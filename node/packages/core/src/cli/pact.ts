import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { ApiversaError } from '../errors.js';
import { createApiversa } from '../create.js';

type Interaction = { version?: string; schema?: string; request?: { body?: unknown }; response?: { body?: unknown } };

/** Upgrade each request and downgrade each response. A missing input writes nothing. */
export function writePact(dir: string, input: string, out: string, today = '2026-11-08'): { ok: boolean; code?: string } {
  if (!existsSync(input)) return { ok: true };
  let interactions: Interaction[];
  try {
    const parsed = JSON.parse(readFileSync(input, 'utf8')) as { interactions?: Interaction[] };
    interactions = Array.isArray(parsed.interactions) ? parsed.interactions : [];
  } catch {
    remove(out);
    return { ok: false, code: 'AV-E001' };
  }
  try {
    const av = createApiversa({ dir, development: false, trace: false, now: today });
    const done = interactions.map((item) => {
      const version = String(item.version ?? '');
      const schema = String(item.schema ?? '');
      av.resolveVersion({ headers: { 'Api-Version': version } });
      return {
        version,
        schema,
        request: { body: av.convertRequest({ schema, version, body: item.request?.body ?? {} }) },
        response: { body: av.convertResponse({ schema, version, body: item.response?.body ?? {} }) },
      };
    });
    writeFileSync(out, `${JSON.stringify({ interactions: done })}\n`);
    return { ok: true };
  } catch (error) {
    remove(out);
    return { ok: false, code: error instanceof ApiversaError ? error.code : 'AV-E001' };
  }
}

function remove(out: string): void {
  if (existsSync(out)) unlinkSync(out);
}
