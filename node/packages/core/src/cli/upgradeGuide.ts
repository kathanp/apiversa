import { changelogBundle } from './changelog.js';

/**
 * Every change strictly newer than `from`, up to head, grouped by endpoint.
 * Descriptions come from the change files. This function does not call the network.
 */
export function upgradeGuide(dir: string, from: string): string {
  const doc = changelogBundle(dir).json;
  const groups = new Map<string, { date: string; id: string; description: string }[]>();
  for (const version of doc.versions) {
    if (version.date <= from) continue;
    for (const change of version.changes) {
      const endpoints = change.endpoints.length > 0 ? change.endpoints : ['(none declared)'];
      for (const endpoint of endpoints) {
        const list = groups.get(endpoint) ?? [];
        list.push({ date: version.date, id: change.id, description: change.description });
        groups.set(endpoint, list);
      }
    }
  }
  const lines = [`# Upgrade from ${from}`, ''];
  if (groups.size === 0) {
    lines.push('_No changes._');
    return lines.join('\n');
  }
  for (const [endpoint, changes] of groups) {
    changes.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
    lines.push(`## ${endpoint}`, '');
    for (const change of changes) lines.push(`- ${change.date}.${change.id}: ${change.description}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
