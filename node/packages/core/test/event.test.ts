import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApiversa } from '../src/create.js';
import type { PinStore } from '../src/model.js';

describe('outgoing events', () => {
  it('downgrades an event to a version and to a subscriber pin', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiversa-event-'));
    writeFileSync(join(dir, 'versions.yaml'), `head: "2026-03-01"
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
default: oldest
`);
    writeFileSync(join(dir, '2026-03-01.add-name.yaml'), `version: "2026-03-01"
id: add-name
description: Hotel.name was added.
changes:
  - op: field.add
    schema: Hotel
    path: name
    default: Bay
`);
    const saved = new Map<string, string>([['partner-a', '2026-01-15'], ['partner-b', '2026-03-01']]);
    const pins: PinStore = { get: (id) => saved.get(id), set: (id, date) => { saved.set(id, date); } };
    const av = createApiversa({ dir, schemas: { Hotel: {} }, pins, development: false, trace: false });
    const head = { id: 'h_1', name: 'Bay' };
    expect(av.downgradeEvent(head, 'Hotel', '2026-03-01')).toBe(head);
    expect(av.downgradeEvent(head, 'Hotel', '2026-01-15')).toEqual({ id: 'h_1' });
    expect(av.downgradeForSubscriber(head, 'Hotel', 'partner-a')).toEqual({ id: 'h_1' });
    expect(av.downgradeForSubscriber(head, 'Hotel', 'partner-b')).toEqual({ id: 'h_1', name: 'Bay' });
    expect(() => av.downgradeForSubscriber(head, 'Hotel', 'partner-c')).toThrow(expect.objectContaining({ code: 'AV-E002' }));
    expect(() => av.downgradeForSubscriber(head, 'Hotel', '')).toThrow(expect.objectContaining({ code: 'AV-E002' }));
    const unpinned = createApiversa({ dir, schemas: { Hotel: {} }, development: false, trace: false });
    expect(() => unpinned.downgradeForSubscriber(head, 'Hotel', 'partner-a')).toThrow(expect.objectContaining({ code: 'AV-E002' }));
  });
});
