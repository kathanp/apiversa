import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const versions = 'head: "2026-03-01"\nversions:\n  - date: "2026-03-01"\n  - date: "2026-01-15"\ndefault: oldest\n';
const change = 'version: "2026-03-01"\nid: rename-city\ndescription: "Hotel.city renamed to locality."\nchanges:\n  - op: field.rename\n    schema: Hotel\n    from: city\n    to: locality\n';
const schema = readFileSync(join(here, '../../../../schema/change-file.schema.json'), 'utf8');

describe('hono on workers', () => {
  it('downgrades a request inside Miniflare', async () => {
    const esbuild = require('esbuild') as typeof import('esbuild');
    const bundled = await esbuild.build({
      stdin: {
        contents: `
          import { Hono } from 'hono';
          import { createApiversa } from 'apiversa';
          import { route } from '@apiversa/hono';
          const av = createApiversa({ dir: '/api-versions', schemas: { Hotel: {} }, development: false, trace: true });
          const app = new Hono();
          app.get('/hotels/:id', route(av, { response: 'Hotel' }), (c) => c.json({ locality: 'Paris' }));
          export default app;
        `,
        resolveDir: join(here, '../../..'),
        sourcefile: 'worker.ts',
        loader: 'ts',
      },
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      write: false,
      define: { 'import.meta.url': JSON.stringify('file:///worker.js') },
      banner: {
        js: 'const __proc = globalThis.process || (globalThis.process = {}); if (typeof __proc.cwd !== "function") __proc.cwd = () => "/"; __proc.env = __proc.env || {};',
      },
      alias: {
        apiversa: join(here, '../../core/src/create.ts'),
        '@apiversa/hono': join(here, '../src/index.ts'),
      },
      plugins: [
        {
          name: 'fs-stub',
          setup(build) {
            build.onResolve({ filter: /^node:fs$/ }, () => ({ path: 'node:fs', namespace: 'fs-stub' }));
            build.onLoad({ filter: /.*/, namespace: 'fs-stub' }, () => ({
              contents: `
                export function readFileSync(path) {
                  const name = String(path);
                  if (name.endsWith('versions.yaml')) return ${JSON.stringify(versions)};
                  if (name.endsWith('.yaml')) return ${JSON.stringify(change)};
                  if (name.endsWith('change-file.schema.json')) return ${JSON.stringify(schema)};
                  const error = new Error('ENOENT ' + name);
                  error.code = 'ENOENT';
                  throw error;
                }
                export function readdirSync() { return ['versions.yaml', '2026-03-01.rename.yaml']; }
                export function existsSync() { return false; }
                export function writeFileSync() {}
                export function mkdirSync() {}
              `,
              loader: 'js',
            }));
          },
        },
      ],
      external: ['node:path', 'node:url', 'node:crypto'],
    });
    const script = bundled.outputFiles?.[0]?.text;
    if (!script) throw new Error('worker bundle was empty');
    const mf = new Miniflare({
      modules: true,
      script,
      compatibilityDate: '2024-12-01',
      compatibilityFlags: ['nodejs_compat'],
    });
    try {
      const response = await mf.dispatchFetch('http://example.com/hotels/h_1', { headers: { 'Api-Version': '2026-01-15' } });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ city: 'Paris' });
    } finally {
      await mf.dispose();
    }
  });
});
