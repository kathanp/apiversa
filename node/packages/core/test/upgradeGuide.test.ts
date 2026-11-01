import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli/main.js';
import { upgradeGuide } from '../src/cli/upgradeGuide.js';

describe('upgrade guide', () => {
  it('lists changes newer than the client date, grouped by endpoint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-guide-'));
    writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\n  - date: "2025-10-01"\ndefault: oldest\n');
    writeFileSync(join(dir, 'routes.json'), JSON.stringify([{ method: 'GET', path: '/hotels/:id', schema: 'Hotel' }]));
    writeFileSync(
      join(dir, '2026-01-15.rename.yaml'),
      'version: "2026-01-15"\nid: rename-city\ndescription: "city became locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n',
    );
    writeFileSync(
      join(dir, '2026-03-01.add.yaml'),
      'version: "2026-03-01"\nid: add-stars\ndescription: "stars was added."\nchanges:\n  - op: field.add\n    schema: Hotel\n    path: stars\n    default: 0\n',
    );
    const guide = upgradeGuide(dir, '2025-10-01');
    expect(guide.indexOf('rename-city')).toBeLessThan(guide.indexOf('add-stars'));
    expect(guide).toContain('## GET /hotels/:id');
    expect(guide).toContain('city became locality.');
    expect(upgradeGuide(dir, '2026-03-01')).toContain('_No changes._');
    expect(upgradeGuide(dir, '2026-01-15')).not.toContain('rename-city');
    expect(runCli(['node', 'apiversa', 'upgrade-guide', '--from', '2025-10-01', dir])).toBe(0);
    expect(runCli(['node', 'apiversa', 'upgrade-guide', dir])).toBe(1);
  });
});