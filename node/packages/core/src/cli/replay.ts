import { readFileSync } from 'node:fs';
import { loadBundle } from '../bundle/load.js';
import { execute } from '../chain/run.js';
import { ApiversaError } from '../errors.js';
import { encodeJson } from '../json/encode.js';
import { fromPlain } from '../json/parse.js';

/**
 * Replay a host-supplied JSONL file of version, schema, request, and response.
 * A line whose downgraded head differs from the recorded response is reported.
 * The file is not sent anywhere.
 */
export function replay(dir: string, samples: string, today?: string): string[] {
  const bundle = loadBundle(dir, { today });
  const text = readFileSync(samples, 'utf8');
  const found: string[] = [];
  let lineNo = 0;
  for (const line of text.split('\n')) {
    lineNo += 1;
    if (line.trim() === '') continue;
    try {
      const sample = JSON.parse(line) as { version?: string; schema?: string; request?: unknown; response?: unknown };
      if (!sample.version || !sample.schema || !('response' in sample)) {
        found.push(`line ${lineNo}: not a sample`);
        continue;
      }
      execute(bundle, { schema: sample.schema, version: sample.version, body: sample.request, trace: false }, 'up');
      const head = execute(bundle, { schema: sample.schema, version: sample.version, body: sample.response, trace: false }, 'up').body;
      const replayed = execute(bundle, { schema: sample.schema, version: sample.version, body: head, trace: false }, 'down').body;
      const actual = encodeJson(fromPlain(replayed, 'down'), 'down');
      const expected = encodeJson(fromPlain(sample.response, 'down'), 'down');
      if (actual !== expected) found.push(`line ${lineNo}: response differs`);
    } catch (error) {
      const code = error instanceof ApiversaError ? error.code : 'error';
      found.push(`line ${lineNo}: ${code}`);
    }
  }
  return found;
}
