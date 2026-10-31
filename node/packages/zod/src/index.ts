import type { Registry, SchemaField } from 'apiversa';

type ZodType = {
  shape?: Record<string, ZodType>;
  def?: { type?: string; shape?: Record<string, ZodType>; innerType?: ZodType; element?: ZodType };
};

/**
 * Build an apiversa registry from Zod objects.
 * Field order is Zod object key order. A nested field whose schema is one of `schemas` is linked by name.
 */
export function defineSchemas(schemas: Record<string, ZodType>): Registry {
  const registry: Registry = {};
  for (const [name, schema] of Object.entries(schemas)) {
    registry[name] = { fields: fieldsOf(schema, schemas) };
  }
  return registry;
}

function fieldsOf(schema: ZodType, schemas: Record<string, ZodType>): SchemaField[] {
  const shape = objectShape(schema);
  if (!shape) return [];
  return Object.keys(shape).map((name) => {
    const field = unwrap(shape[name]!);
    const nested = matchNamed(field, schemas);
    if (nested) return { name, schema: nested };
    const element = arrayElement(field);
    if (element) {
      const item = matchNamed(unwrap(element), schemas);
      if (item) return { name, items: item };
    }
    return { name };
  });
}

function objectShape(schema: ZodType): Record<string, ZodType> | undefined {
  if (schema.shape && typeof schema.shape === 'object') return schema.shape;
  const shape = schema.def?.shape;
  if (shape && typeof shape === 'object') return shape;
  return undefined;
}

function unwrap(schema: ZodType): ZodType {
  const type = schema.def?.type;
  if ((type === 'optional' || type === 'nullable' || type === 'default') && schema.def?.innerType) return unwrap(schema.def.innerType);
  return schema;
}

function arrayElement(schema: ZodType): ZodType | undefined {
  if (schema.def?.type === 'array' && schema.def.element) return schema.def.element;
  return undefined;
}

function matchNamed(schema: ZodType, schemas: Record<string, ZodType>): string | undefined {
  for (const [name, candidate] of Object.entries(schemas)) if (candidate === schema) return name;
  return undefined;
}
