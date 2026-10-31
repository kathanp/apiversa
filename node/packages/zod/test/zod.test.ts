import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineSchemas } from '@apiversa/zod';

describe('zod registry', () => {
  it('keeps object key order and links a nested schema by identity', () => {
    const Hotel = z.object({ id: z.string(), city: z.string() });
    const Booking = z.object({ hotel: Hotel, note: z.string().optional() });
    const registry = defineSchemas({ Hotel, Booking });
    expect(registry.Hotel?.fields?.map((field) => field.name)).toEqual(['id', 'city']);
    expect(registry.Booking?.fields).toEqual([{ name: 'hotel', schema: 'Hotel' }, { name: 'note' }]);
  });

  it('links an array item schema and ignores a schema with no object shape', () => {
    const Hotel = z.object({ id: z.string() });
    const Page = z.object({ hotels: z.array(Hotel), note: z.string().nullable().default('x') });
    const registry = defineSchemas({ Hotel, Page, Note: z.string() });
    expect(registry.Page?.fields?.[0]).toEqual({ name: 'hotels', items: 'Hotel' });
    expect(registry.Note?.fields).toEqual([]);
    const shaped = defineSchemas({
      Bare: { def: { shape: { id: { def: { type: 'string' } } } } },
    });
    expect(shaped.Bare?.fields?.map((field) => field.name)).toEqual(['id']);
  });
});
