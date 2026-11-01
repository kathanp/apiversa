import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiVersionProvider, createApiVersion, useApiVersion } from '../src/index.js';

describe('react hook', () => {
  it('reads the pinned client from the provider and does not call the network', () => {
    const client = createApiVersion({
      baseUrl: 'https://api.example',
      version: '2026-01-15',
      fetch: async () => ({ status: 200, json: async () => ({ ok: true }) }),
    });
    function Show() {
      return createElement('span', null, useApiVersion().version);
    }
    const html = renderToStaticMarkup(createElement(ApiVersionProvider, { client }, createElement(Show)));
    expect(html).toBe('<span>2026-01-15</span>');
    expect(() => renderToStaticMarkup(createElement(Show))).toThrow(/ApiVersionProvider/);
  });
});
