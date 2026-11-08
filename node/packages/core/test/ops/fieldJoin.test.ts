import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBundle } from '../../src/bundle/load.js';
import { createApiversa } from '../../src/create.js';
import { runOp } from '../helpers.js';

const op = { op: 'field.join', schema: 'Person', from: 'name', left: 'left', right: 'right', separator: ' ' };

describe('field.join', () => {
  it('joins two strings on the way up and restores both fields on the way down', () => {
    expect(runOp(op, { left: 'Ada', right: 'Lovelace' }, 'up', ['name'], 'Person')).toEqual({ name: 'Ada Lovelace' });
    expect(runOp(op, { name: 'Ada Lovelace' }, 'down', ['left', 'right'], 'Person')).toEqual({ left: 'Ada', right: 'Lovelace' });
    expect(runOp(op, { name: 'A B C' }, 'down', ['left', 'right'], 'Person')).toEqual({ left: 'A', right: 'B C' });
  });

  it('returns AV-E020 when from is already present on the way up', () => {
    expect(() => runOp(op, { left: 'Ada', right: 'Lovelace', name: 'Ada' }, 'up', undefined, 'Person')).toThrow(
      expect.objectContaining({ code: 'AV-E020', status: 400, message: 'Target is already set.' }),
    );
    expect(() => runOp(op, { left: 'Ada' }, 'up', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E021', status: 400 }));
    expect(() => runOp(op, { name: 'AdaLovelace' }, 'down', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E021', status: 500 }));
    expect(() => runOp(op, { name: 1 }, 'down', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E016', status: 500 }));
  });

  it('CORE-33 refuses a regular expression', () => {
    expect(() => buildBundle(versions(), [change('/a/')], { today: '2026-10-30', registry: { Person: {} } })).toThrow(
      expect.objectContaining({ code: 'AV-E001' }),
    );
  });

  it('CORE-33 refuses a third field', () => {
    const extra = { ...change(' '), changes: [{ ...(change(' ').changes as object[])[0], extra: true }] };
    expect(() => buildBundle(versions(), [extra], { today: '2026-10-30', registry: { Person: {} } })).toThrow(
      expect.objectContaining({ code: 'AV-E001' }),
    );
  });

  it('CORE-33 refuses running a handler more than once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-join-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
    writeFileSync(join(dir, '2026-03-01.join.yaml'), 'version: "2026-03-01"\nid: join-name\ndescription: "left and right became name."\nchanges:\n  - op: field.join\n    schema: Person\n    from: name\n    left: left\n    right: right\n    separator: " "\n');
    let calls = 0;
    const av = createApiversa({
      dir,
      schemas: { Person: { fields: [{ name: 'name' }] } },
      development: false,
      trace: false,
      onConvert: () => {
        calls += 1;
      },
    });
    expect(av.convertRequest({ schema: 'Person', version: '2026-01-15', body: { left: 'Ada', right: 'Lovelace' } })).toEqual({ name: 'Ada Lovelace' });
    expect(calls).toBe(1);
  });
});

function versions(): unknown {
  return { head: '2026-03-01', default: 'oldest', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
}

function change(separator: string): { version: string; id: string; description: string; changes: object[] } {
  return {
    version: '2026-03-01',
    id: 'join-name',
    description: 'left and right became name.',
    changes: [{ op: 'field.join', schema: 'Person', from: 'name', left: 'left', right: 'right', separator }],
  };
}
