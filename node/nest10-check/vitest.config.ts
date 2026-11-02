import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const nest10 = fileURLToPath(new URL('../../nest10-check/node_modules/', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      apiversa: fileURLToPath(new URL('../packages/core/src/index.ts', import.meta.url)),
      '@nestjs/common': nest10 + '@nestjs/common',
      '@nestjs/core': nest10 + '@nestjs/core',
      '@nestjs/platform-express': nest10 + '@nestjs/platform-express',
      '@nestjs/platform-fastify': nest10 + '@nestjs/platform-fastify',
      '@nestjs/testing': nest10 + '@nestjs/testing',
    },
  },
  test: {
    include: ['fw03.test.ts'],
  },
});
