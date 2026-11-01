import { describe, expect, it } from 'vitest';
import { startConversion, type Span } from '../src/index.js';

describe('otel spans', () => {
  it('records one span for an old version and none for head', () => {
    const spans: { name: string; attributes: Record<string, string | number> }[] = [];
    const tracer = {
      startSpan(name: string): Span {
        const attributes: Record<string, string | number> = {};
        const span = {
          setAttribute(key: string, value: string | number) {
            attributes[key] = value;
          },
          end() {
            spans.push({ name, attributes });
          },
        };
        return span;
      },
    };
    expect(startConversion(tracer, { version: '2026-03-01', head: '2026-03-01', changes: '', direction: 'down', ms: 1 })).toBeUndefined();
    startConversion(tracer, { version: '2026-01-15', head: '2026-03-01', changes: '2026-03-01.rename-city', direction: 'down', ms: 2 });
    expect(spans).toEqual([
      { name: 'apiversa.convert', attributes: { 'apiversa.version': '2026-01-15', 'apiversa.changes': '2026-03-01.rename-city', 'apiversa.direction': 'down', 'apiversa.ms': 2 } },
    ]);
  });
});
