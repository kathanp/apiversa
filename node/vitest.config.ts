import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Thresholds are the F2 gates. Do not lower them.
export default defineConfig({
  resolve: {
    alias: {
      apiversa: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@apiversa/zod': fileURLToPath(new URL('./packages/zod/src/index.ts', import.meta.url)),
      '@apiversa/express': fileURLToPath(new URL('./packages/express/src/index.ts', import.meta.url)),
      '@apiversa/fastify': fileURLToPath(new URL('./packages/fastify/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['packages/*/src/**/*.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
});
