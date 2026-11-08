import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../src/bundle/load.js';
import { runOp } from '../helpers.js';

const op = { op: 'field.split', schema: 'Person', from: 'name', left: 'left', right: 'right', separator: ' ' };

describe('field.split', () => {
  it('splits on the first literal separator and joins the same string back', () => {
    expect(runOp(op, { name: 'Ada Lovelace' }, 'up', ['left', 'right'], 'Person')).toEqual({ left: 'Ada', right: 'Lovelace' });
    expect(runOp(op, { name: 'A B C' }, 'up', ['left', 'right'], 'Person')).toEqual({ left: 'A', right: 'B C' });
    expect(runOp(op, { left: 'Ada', right: 'Lovelace' }, 'down', ['left', 'right'], 'Person')).toEqual({ name: 'Ada Lovelace' });
  });

  it('rejects a target that is already set and a missing separator', () => {
    expect(() => runOp(op, { name: 'Ada Lovelace', left: 'Ada' }, 'up', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E020', status: 400, message: 'Target is already set.' }));
    expect(() => runOp(op, { name: 'AdaLovelace' }, 'up', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E021', status: 400, message: 'Separator was not found.' }));
    expect(() => runOp(op, { name: 1 }, 'up', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E016', status: 400 }));
    expect(() => runOp(op, { name: 'Ada', left: 'Ada', right: 'Lovelace' }, 'down', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E020', status: 500 }));
    expect(() => runOp(op, { left: 'Ada' }, 'down', undefined, 'Person')).toThrow(expect.objectContaining({ code: 'AV-E021', status: 500 }));
  });

  it('rejects an empty separator, a long separator, and a regex literal at startup', () => {
    for (const separator of ['', 'x'.repeat(33), '/\\s+/']) {
      expect(() =>
        buildBundle(versions(), [change(separator)], { today: '2026-10-30', registry: { Person: {} } }),
      ).toThrow(expect.objectContaining({ code: 'AV-E001' }));
    }
  });
});

function versions(): unknown {
  return { head: '2026-03-01', default: 'oldest', versions: [{ date: '2026-03-01' }, { date: '2026-01-15' }] };
}

function change(separator: string): unknown {
  return {
    version: '2026-03-01',
    id: 'split-name',
    description: 'name split into left and right.',
    changes: [{ op: 'field.split', schema: 'Person', from: 'name', left: 'left', right: 'right', separator }],
  };
}
