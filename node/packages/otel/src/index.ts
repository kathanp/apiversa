export type Span = {
  setAttribute(key: string, value: string | number): void;
  end(): void;
};

export type Tracer = {
  startSpan(name: string): Span;
};

/**
 * One span per conversion that is not the head version.
 * A head request returns undefined and records nothing.
 */
export function startConversion(
  tracer: Tracer,
  input: { version: string; head: string; changes: string; direction: 'up' | 'down'; ms: number },
): Span | undefined {
  if (input.version === input.head) return undefined;
  const span = tracer.startSpan('apiversa.convert');
  span.setAttribute('apiversa.version', input.version);
  span.setAttribute('apiversa.changes', input.changes);
  span.setAttribute('apiversa.direction', input.direction);
  span.setAttribute('apiversa.ms', input.ms);
  span.end();
  return span;
}
