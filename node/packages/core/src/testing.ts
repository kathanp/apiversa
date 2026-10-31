/** Vitest matcher. `schema` is a Zod schema (`safeParse`) or a predicate. */
export function toMatchVersion(
  received: unknown,
  date: string,
  schema: { safeParse?: (value: unknown) => { success: boolean } } | ((value: unknown) => boolean),
): { pass: boolean; message: () => string } {
  const record = received && typeof received === 'object' ? (received as { body?: unknown; headers?: Record<string, unknown> }) : undefined;
  const body = record && 'body' in record ? record.body : received;
  const headers = record?.headers;
  const header = headers ? String(headers['api-version'] ?? headers['Api-Version'] ?? '') : '';
  const headerOk = !headers || header === '' || header === date;
  const schemaOk = typeof schema === 'function' ? schema(body) : Boolean(schema.safeParse?.(body)?.success);
  const pass = headerOk && schemaOk;
  return { pass, message: () => `expected value to match version ${date}` };
}
