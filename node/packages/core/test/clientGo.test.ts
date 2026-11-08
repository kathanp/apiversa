import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clientSources, writeClientFiles } from '../src/cli/clients.js';

const older = `package generated

type Hotel_2026_01_15 struct {
	city string \`json:"city"\`
	place string \`json:"place"\`
	address Address_2026_01_15 \`json:"address"\`
	given string \`json:"given"\`
	family string \`json:"family"\`
	active bool \`json:"active"\`
	score float64 \`json:"score"\`
}
`;

const head = `package generated

type Hotel_2026_03_01 struct {
	locality string \`json:"locality"\`
	cities []string \`json:"cities"\`
	stars int64 \`json:"stars"\`
	address Address_2026_03_01 \`json:"address"\`
	title string \`json:"title"\`
	active bool \`json:"active"\`
	score float64 \`json:"score"\`
}
`;

describe('CLIENT-06 go client files', () => {
  it('writes the same struct bytes', () => {
    const dir = fixture();
    expect(clientSources(dir, 'go', '2026-11-08').find((file) => file.name === 'Hotel_2026_01_15.go')?.text).toBe(older);
    expect(clientSources(dir, 'go', '2026-11-08').find((file) => file.name === 'Hotel_2026_03_01.go')?.text).toBe(head);
    writeClientFiles(dir, 'go', '2026-11-08');
    expect(readFileSync(join(dir, 'generated/Hotel_2026_03_01.go'), 'utf8')).toBe(head);
  });

  it('CLIENT-06 refuses calling the go tool', () => {
    const dir = fixture();
    writeClientFiles(dir, 'go', '2026-11-08');
    expect(readdirSync(join(dir, 'generated')).every((name) => name.endsWith('.go'))).toBe(true);
  });

  it('CLIENT-06 refuses calling the network', () => {
    const text = clientSources(fixture(), 'go', '2026-11-08').map((file) => file.text).join('');
    expect(text).toContain('json:"city"');
    expect(text).not.toContain('http');
  });
});

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-go-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.reshape.yaml'), `version: "2026-03-01"
id: reshape
description: "Hotel fields moved."
changes:
  - op: field.alias
    schema: Hotel
    from: city
    to: locality
  - op: field.list
    schema: Hotel
    from: place
    to: cities
  - op: field.null
    schema: Hotel
    path: stars
  - op: field.join
    schema: Hotel
    from: title
    left: given
    right: family
    separator: " "
`);
  writeFileSync(join(dir, 'head.json'), JSON.stringify({
    Hotel: [
      { name: 'locality', type: 'string' },
      { name: 'cities', type: 'array' },
      { name: 'stars', type: 'integer' },
      { name: 'address', type: 'Address' },
      { name: 'title', type: 'string' },
      { name: 'active', type: 'boolean' },
      { name: 'score', type: 'number' },
    ],
    Address: [{ name: 'line', type: 'string' }],
  }));
  return dir;
}
