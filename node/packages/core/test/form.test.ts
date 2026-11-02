import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiversa } from '../src/create.js';
import { convertForm } from '../src/form.js';

function av() {
  const dir = mkdtempSync(join(tmpdir(), 'apiversa-form-'));
  writeFileSync(join(dir, 'versions.yaml'), 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n');
  writeFileSync(join(dir, '2026-03-01.rename.yaml'), 'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n');
  return createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
}

describe('form bodies', () => {
  it('renames a urlencoded field and copies a file part through', () => {
    const engine = av();
    const up = convertForm(engine, 'city=Paris&note=x', 'application/x-www-form-urlencoded', 'Hotel', '2026-01-15', 'up');
    expect(up.fields).toEqual({ locality: 'Paris', note: 'x' });
    expect(up.body).toBe('note=x&locality=Paris');
    const head = convertForm(engine, 'locality=Paris', 'application/x-www-form-urlencoded', 'Hotel', '2026-03-01', 'up');
    expect(head.fields).toEqual({ locality: 'Paris' });
    const file = 'hello-file';
    const multipart = `--b\r\nContent-Disposition: form-data; name="city"\r\n\r\nParis\r\n--b\r\nContent-Disposition: form-data; name="photo"; filename="a.txt"\r\nContent-Type: application/octet-stream\r\n\r\n${file}\r\n--b--\r\n`;
    const converted = convertForm(engine, multipart, 'multipart/form-data; boundary=b', 'Hotel', '2026-01-15', 'up');
    expect(converted.fields).toEqual({ locality: 'Paris' });
    expect(converted.body).toContain('name="locality"');
    expect(converted.body).toContain(file);
    expect(converted.body).toContain('filename="a.txt"');
    expect(convertForm(engine, 'city=Paris', 'text/plain', 'Hotel', '2026-01-15', 'up')).toEqual({ fields: {}, body: 'city=Paris' });
    expect(convertForm(engine, multipart, 'multipart/form-data', 'Hotel', '2026-01-15', 'up').body).toBe(multipart);
    expect(() => convertForm(engine, 'city=Paris&city=Lyon', 'application/x-www-form-urlencoded', 'Hotel', '2026-01-15', 'up')).toThrow(expect.objectContaining({ code: 'AV-E015' }));
  });
});
