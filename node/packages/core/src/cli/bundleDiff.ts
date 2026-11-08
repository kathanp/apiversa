import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../bundle/load.js';
import { ApiversaError } from '../errors.js';

export type BundleDiff = { onlyLeft: string[]; onlyRight: string[]; changed: string[] };

/** Dates only one side has, newest first, and change-file names whose bytes differ. */
export function diffBundles(left: string, right: string, today = '2026-11-08'): BundleDiff {
  const leftBundle = loadBundle(left, { today });
  const rightBundle = loadBundle(right, { today });
  const rightDates = new Set(rightBundle.dates);
  const leftDates = new Set(leftBundle.dates);
  const names = new Set([...changeNames(left), ...changeNames(right)]);
  return {
    onlyLeft: leftBundle.dates.filter((date) => !rightDates.has(date)),
    onlyRight: rightBundle.dates.filter((date) => !leftDates.has(date)),
    changed: [...names].filter((name) => readChange(left, name) !== readChange(right, name)).sort(),
  };
}

export function writeBundleDiff(left: string, right: string, out: string, today = '2026-11-08'): { ok: boolean; code?: string } {
  try {
    writeFileSync(out, `${JSON.stringify(diffBundles(left, right, today))}\n`);
    return { ok: true };
  } catch (error) {
    if (existsSync(out)) unlinkSync(out);
    return { ok: false, code: error instanceof ApiversaError ? error.code : 'AV-E001' };
  }
}

function changeNames(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.yaml') && name !== 'versions.yaml');
}

function readChange(dir: string, name: string): string {
  const path = join(dir, name);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}
