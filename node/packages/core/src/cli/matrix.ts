import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '../bundle/load.js';

export type UpgradeMatrix = { head: string; versions: Record<string, { id: string; description: string }[]> };

/**
 * Changes between each older date and head, in chain order.
 * Descriptions come from the change files. Nothing is sent.
 */
export function upgradeMatrix(dir: string, today?: string): UpgradeMatrix {
  const bundle = loadBundle(dir, { today });
  const versions: UpgradeMatrix['versions'] = {};
  for (const date of bundle.dates) {
    const changes = bundle.changes.filter((change) => change.version > date);
    changes.sort((left, right) => left.version.localeCompare(right.version) || left.id.localeCompare(right.id));
    versions[date] = changes.map((change) => ({ id: `${change.version}.${change.id}`, description: change.description }));
  }
  return { head: bundle.head, versions };
}

/** Write `upgrade-matrix.json`. `out` chooses the path. */
export function writeMatrix(dir: string, out?: string, today?: string): string {
  const file = out ?? join(process.cwd(), 'upgrade-matrix.json');
  writeFileSync(file, `${JSON.stringify(upgradeMatrix(dir, today))}\n`);
  return file;
}
