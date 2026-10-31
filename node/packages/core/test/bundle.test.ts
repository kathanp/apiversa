import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBundle, loadBundle } from '../src/bundle/load.js';
import { ApiversaError } from '../src/errors.js';
import { parseYaml } from '../src/yaml/parse.js';

const versions = (dates: string[], head = dates[0], extra = '') => `head: "${head}"
versions:
${dates.map((date) => `  - date: "${date}"`).join('\n')}
${extra}`;

function day(): string {
  return '2026-10-30';
}

describe('CORE-01 version bundle', () => {
  it('loads a valid bundle', () => {
    const bundle = buildBundle(yaml(versions(['2026-03-01', '2026-01-15'])), [], { today: day() });
    expect(bundle.head).toBe('2026-03-01');
    expect(bundle.oldest).toBe('2026-01-15');
    expect(bundle.policy).toBe('oldest');
  });

  it('refuses unsorted dates', () => {
    expect(() => buildBundle(yaml(versions(['2026-01-15', '2026-03-01'])), [], { today: day() })).toThrow(ApiversaError);
  });

  it('refuses a duplicate date', () => {
    expect(() => buildBundle(yaml(versions(['2026-03-01', '2026-03-01'])), [], { today: day() })).toThrow(expect.objectContaining({ code: 'AV-E001' }));
  });

  it('refuses a future date', () => {
    expect(() => buildBundle(yaml(versions(['2099-01-01'])), [], { today: day() })).toThrow(expect.objectContaining({ code: 'AV-E003', message: 'Version date is in the future.' }));
  });

  it('refuses a malformed date', () => {
    expect(() => buildBundle(yaml(versions(['2026-02-31'])), [], { today: day() })).toThrow(expect.objectContaining({ code: 'AV-E001' }));
  });

  it('refuses a head that is not the newest date', () => {
    expect(() => buildBundle(yaml(versions(['2026-03-01', '2026-01-15'], '2026-01-15')), [], { today: day() })).toThrow(expect.objectContaining({ code: 'AV-E001' }));
  });

  it('loads change files from a directory and skips a commented example', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-'));
    writeFileSync(join(dir, 'versions.yaml'), versions(['2026-01-15']));
    writeFileSync(join(dir, '2026-03-01.price-object.yaml'), '# commented only\n');
    const bundle = loadBundle(dir, { today: day(), registry: { Hotel: {} } });
    expect(bundle.changes).toHaveLength(0);
  });
});

function yaml(text: string): unknown {
  return parseYaml(text);
}
