import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml } from '../yaml/parse.js';

/**
 * Remove a version and the change files no remaining version selects.
 * Refuses when `usage.json` shows requests for that version, unless `force` is set.
 * Does not call the network.
 */
export function retire(dir: string, date: string, options?: { force?: boolean; usagePath?: string }): string[] {
  const usagePath = options?.usagePath ?? join(dir, 'usage.json');
  const requests = readRequests(usagePath);
  if ((requests[date] ?? 0) > 0 && !options?.force) {
    throw new Error(`Refusing to retire ${date} while it has traffic. Pass --force.`);
  }
  const versionsPath = join(dir, 'versions.yaml');
  const doc = parseYaml(readFileSync(versionsPath, 'utf8')) as { head?: string; default?: string; versions?: { date?: string; deprecated?: boolean; sunset?: string }[] };
  const versions = doc.versions ?? [];
  if (doc.head === date && !options?.force) throw new Error(`Refusing to retire head ${date} without --force.`);
  const remaining = versions.filter((item) => item.date !== date);
  if (remaining.length === versions.length) throw new Error(`${date} is not a version.`);
  if (remaining.length === 0) throw new Error('Refusing to retire the only version.');
  const dates = remaining.map((item) => String(item.date));
  const head = doc.head === date ? dates[0] : doc.head;
  const lines = [`head: ${JSON.stringify(head)}`, 'versions:'];
  for (const item of remaining) {
    lines.push(`  - date: ${JSON.stringify(item.date)}`);
    if (item.deprecated) lines.push('    deprecated: true');
    if (item.sunset) lines.push(`    sunset: ${JSON.stringify(item.sunset)}`);
  }
  if (doc.default) lines.push(`default: ${doc.default}`);
  writeFileSync(versionsPath, `${lines.join('\n')}\n`);
  const removed: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.yaml') || name === 'versions.yaml') continue;
    const file = parseYaml(readFileSync(join(dir, name), 'utf8')) as { version?: string };
    const version = String(file.version ?? '');
    if (!dates.some((item) => item < version)) {
      unlinkSync(join(dir, name));
      removed.push(name);
    }
  }
  return removed;
}

function readRequests(path: string): Record<string, number> {
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { requests?: Record<string, number> };
  return parsed.requests ?? {};
}
