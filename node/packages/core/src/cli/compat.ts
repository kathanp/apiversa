import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../bundle/load.js';

export type CompatibilityVersion = { date: string; deprecated: boolean; sunset: string | null; sunsetEnforce: boolean; changes: string[] };
export type Compatibility = { head: string; versions: CompatibilityVersion[] };

/** Dates newest first. Change ids between that date and head, in chain order. */
export function compatibility(dir: string, today?: string): Compatibility {
  const bundle = loadBundle(dir, { today });
  const info = new Map(bundle.versionInfo.map((item) => [item.date, item]));
  return {
    head: bundle.head,
    versions: bundle.dates.map((date) => {
      const item = info.get(date);
      const changes = bundle.changes.filter((change) => change.version > date);
      changes.sort((left, right) => left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
      return {
        date,
        deprecated: item?.deprecated === true,
        sunset: item?.sunset ?? null,
        sunsetEnforce: item?.sunsetEnforce === true,
        changes: changes.map((change) => change.id),
      };
    }),
  };
}

/** Write `compatibility.json`. `out` chooses the path. The default is the working directory. */
export function writeCompat(dir: string, out?: string, today?: string, cwd = process.cwd()): string {
  const file = out ?? join(cwd, 'compatibility.json');
  writeFileSync(file, `${JSON.stringify(compatibility(dir, today))}\n`);
  return file;
}
