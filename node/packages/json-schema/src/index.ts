import type { Registry, SchemaField } from 'apiversa';

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  $ref?: string;
};

/**
 * Registry from plain JSON Schema draft 2020-12 objects.
 * Field order is the order of `properties`.
 */
export function defineJsonSchemas(schemas: Record<string, JsonSchema>): Registry {
  return defineFrom(schemas);
}

/** TypeBox object schemas are JSON Schema. This reads the same `properties` order. */
export function defineTypeBoxSchemas(schemas: Record<string, JsonSchema>): Registry {
  return defineFrom(schemas);
}

function defineFrom(schemas: Record<string, JsonSchema>): Registry {
  const registry: Registry = {};
  for (const [name, schema] of Object.entries(schemas)) registry[name] = { fields: fieldsOf(schema, schemas) };
  return registry;
}

function fieldsOf(schema: JsonSchema, schemas: Record<string, JsonSchema>): SchemaField[] {
  const properties = schema.properties ?? {};
  return Object.keys(properties).map((name) => {
    const field = properties[name] ?? {};
    const ref = refName(field.$ref);
    if (ref && ref in schemas) return { name, schema: ref };
    const item = refName(field.items?.$ref);
    if (item && item in schemas) return { name, items: item };
    return { name };
  });
}

function refName(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const slash = ref.lastIndexOf('/');
  return slash === -1 ? ref : ref.slice(slash + 1);
}
