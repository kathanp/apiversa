import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiversaError, createApiversa } from 'apiversa';
import { sqs } from '../src/index.js';

const VERSIONS = 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n';

function dir(name: string, change: string): string {
  const folder = mkdtempSync(join(tmpdir(), name));
  writeFileSync(join(folder, 'versions.yaml'), VERSIONS);
  writeFileSync(join(folder, '2026-03-01.change.yaml'), change);
  return folder;
}

const RENAME = 'version: "2026-03-01"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n';

describe('EVT-05 SQS', () => {
  it('upgrades an older body, keeps an empty plan, and rejects an unknown date', () => {
    const av = createApiversa({ dir: dir('apiversa-sqs-', RENAME), development: false, trace: false });
    const messages = sqs(av, 'Hotel');
    const head = { locality: 'Paris' };
    expect(messages.upgrade({ city: 'Paris' }, { 'Api-Version': '2026-01-15' })).toEqual({ locality: 'Paris' });
    expect(messages.upgrade(head, { 'Api-Version': '2026-03-01' })).toBe(head);
    expect(messages.downgrade({ locality: 'Paris' }, '2026-01-15')).toEqual({ city: 'Paris' });
    try {
      messages.upgrade({}, { 'Api-Version': '2026-02-01' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiversaError);
      expect((error as ApiversaError).code).toBe('AV-E002');
    }
  });

  it('returns no body when conversion fails and does not open a socket', () => {
    const av = createApiversa({
      dir: dir('apiversa-sqs-fail-', 'version: "2026-03-01"\nid: boom\ndescription: "boom"\nchanges:\n  - op: custom\n    converter: boom\n'),
      development: false,
      trace: false,
      converters: { boom: { up() { throw new ApiversaError('AV-E016', 'up'); } } },
    });
    expect(sqs(av, 'Hotel').upgrade({ city: 'Paris' }, { 'Api-Version': '2026-01-15' })).toBeUndefined();
  });
});
