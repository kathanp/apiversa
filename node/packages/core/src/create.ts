import type { Direction } from './errors.js';
import { ApiversaError, fail } from './errors.js';
import { loadBundle, planFor, type Bundle } from './bundle/load.js';
import { deprecationHeaders, memoryPins, Usage, type CountSnapshot, type MetricPoint } from './lifecycle.js';
import { clientField, clientValidation, type ClientField, type ClientIssue, type SchemaParser } from './clientField.js';

export type { ClientField, ClientIssue, SchemaParser };
export { memoryPins };
export type { CountSnapshot, MetricPoint };
import { bodyPlanEmpty, execute, type ExecuteResult } from './chain/run.js';
import { DEFAULT_LIMITS } from './limits.js';
import type { Converter, HeaderPair, PinStore, QueryPair } from './model.js';
import type { Registry } from './json/parse.js';
import { readHeader, resolveVersion, type HeaderInput } from './resolve/version.js';

export type { Registry, SchemaDef, SchemaField } from './json/parse.js';
export type { Converter, PinStore, QueryPair, HeaderPair } from './model.js';
export { ApiversaError } from './errors.js';

export type ConvertInput = {
  schema?: string;
  body?: unknown;
  version?: string;
  headers?: HeaderInput;
  method?: string;
  path?: string;
  query?: QueryPair[] | string;
  responseHeaders?: HeaderPair[];
  status?: number;
  isError?: boolean;
  errorCode?: string;
  clientId?: string;
  request?: unknown;
};

export type CreateOptions = {
  dir: string;
  /** Ordered field lists. Build them with `@apiversa/zod` when the host uses Zod. */
  schemas?: Registry;
  /** Version header name. Default `Api-Version`. */
  header?: string;
  /** Host lookup, for example the API key's pinned version. Runs after the header. */
  resolve?: (request: unknown) => string | undefined;
  converters?: Record<string, Converter>;
  pins?: PinStore;
  maxBodyBytes?: number;
  maxArrayItems?: number;
  /** `error` returns AV-E008. `passthrough` sends an oversized response in head shape. */
  oversize?: 'error' | 'passthrough';
  /** Force the Apiversa-Trace header. Off in production unless this is true. */
  trace?: boolean;
  /** Deep-freeze converter inputs. Defaults to on outside production. */
  development?: boolean;
  /** Called with the in-memory counters after each noted request. The hook must not be used to open a socket inside apiversa. */
  onCount?: (snapshot: CountSnapshot) => void;
};

export type Apiversa = {
  /** Resolve the client version: header, host resolver, then the bundle default. */
  resolveVersion(input: { headers?: HeaderInput; request?: unknown; clientId?: string }): string;
  /** Upgrade a request body to head. Returns the original reference when the plan is empty. */
  convertRequest(input: ConvertInput): unknown;
  /** Downgrade a response body from head. Returns the original reference when the plan is empty. */
  convertResponse(input: ConvertInput): unknown;
  /** Full request or response conversion, including path, query, headers, and trace. */
  prepare(direction: Direction, input: ConvertInput): ExecuteResult;
  /** True when this version and schema need no body parse. */
  planIsEmpty(version: string, schema: string | undefined, direction: Direction): boolean;
  /** Head path translated into the client's field name. A later field is `_head`. */
  clientField(version: string, schema: string, headPath: string): ClientField;
  /** Head-schema issues, rewritten for the client. A passing parse returns undefined. */
  clientValidation(version: string, schema: string, body: unknown, parser: SchemaParser): ClientIssue[] | undefined;
  /** Outgoing event in that version's shape. Same `down` chain as a response. */
  downgradeEvent(payload: unknown, schema: string, version: string): unknown;
  /** Downgrade using the subscriber's pin. A missing pin is AV-E002. */
  downgradeForSubscriber(payload: unknown, schema: string, subscriberId: string): unknown;
  /** Deprecation, Sunset, and Link for a deprecated version. Empty when it is not deprecated. */
  deprecationHeaders(version: string): { name: string; value: string }[];
  /** Count one request. A client id is counted only when the caller has one. */
  note(version: string, clientId?: string): void;
  /** In-memory request, conversion, and client counts. */
  stats(): CountSnapshot;
  /** Prometheus text. The host scrapes it. apiversa does not send it. */
  prometheus(): string;
  /** Metric points a host can hand to its own OpenTelemetry meter. */
  metrics(): MetricPoint[];
};

/**
 * Load `versions.yaml` and the change files in `dir`, and compile conversion plans.
 * Plans are fixed at startup. An empty plan does not parse the body.
 */
export function createApiversa(options: CreateOptions): Apiversa {
  const development = options.development ?? process.env.NODE_ENV !== 'production';
  const trace = options.trace === true || (development && options.trace !== false);
  const usage = new Usage();
  const bundle = loadBundle(options.dir, {
    registry: options.schemas ?? {},
    converters: options.converters,
    pins: options.pins,
    limits: {
      maxBodyBytes: options.maxBodyBytes ?? DEFAULT_LIMITS.maxBodyBytes,
      maxArrayItems: options.maxArrayItems ?? DEFAULT_LIMITS.maxArrayItems,
    },
    oversize: options.oversize,
  });
  return api(bundle, { header: options.header ?? 'Api-Version', resolve: options.resolve, development, trace, usage, onCount: options.onCount });
}

export function api(
  bundle: Bundle,
  opts: { header: string; resolve?: (request: unknown) => string | undefined; development: boolean; trace: boolean; usage?: Usage; onCount?: (snapshot: CountSnapshot) => void },
): Apiversa {
  const usage = opts.usage ?? new Usage();
  function hostVersion(input: { headers?: HeaderInput; request?: unknown }): string | undefined {
    if (readHeader(input.headers, opts.header).length > 0) return undefined;
    if (input.request === undefined || !opts.resolve) return undefined;
    return opts.resolve(input.request);
  }
  function prepare(direction: Direction, input: ConvertInput): ExecuteResult {
    const version = input.version
      ? resolveVersion(bundle, { headers: { [opts.header]: input.version }, headerName: opts.header })
      : resolveVersion(bundle, { headers: input.headers, headerName: opts.header, resolved: hostVersion(input), clientId: input.clientId });
    return execute(
      bundle,
      {
        schema: input.schema,
        version,
        body: input.body,
        method: input.method,
        path: input.path,
        query: typeof input.query === 'string' ? parseQuery(input.query) : input.query,
        headers: direction === 'down' ? input.responseHeaders : headersFrom(input.headers),
        status: input.status,
        isError: input.isError,
        errorCode: input.errorCode,
        development: opts.development,
        trace: opts.trace,
      },
      direction,
    );
  }
  return {
    resolveVersion(input) {
      return resolveVersion(bundle, { headers: input.headers, headerName: opts.header, resolved: hostVersion(input), clientId: input.clientId });
    },
    convertRequest(input) {
      return prepare('up', input).body;
    },
    convertResponse(input) {
      return prepare('down', input).body;
    },
    prepare,
    planIsEmpty(version, schema, direction) {
      return bodyPlanEmpty(bundle, version, schema, direction);
    },
    clientField(version, schema, headPath) {
      return clientField(bundle, version, schema, headPath);
    },
    clientValidation(version, schema, body, parser) {
      return clientValidation(bundle, version, schema, body, parser);
    },
    downgradeEvent(payload, schema, version) {
      return prepare('down', { schema, body: payload, version }).body;
    },
    downgradeForSubscriber(payload, schema, subscriberId) {
      const pinned = subscriberId ? bundle.pins?.get(subscriberId) : undefined;
      if (!bundle.pins || !subscriberId || !pinned) throw fail('AV-E002', 'down', 'no pin for subscriber', bundle.dates);
      return prepare('down', { schema, body: payload, version: pinned }).body;
    },
    deprecationHeaders(version) {
      return deprecationHeaders(bundle, version);
    },
    note(version, clientId) {
      const ids = [...new Set(planFor(bundle, version, 'up').map((step) => `${step.version}.${step.id}`))];
      usage.record(version, clientId, ids);
      opts.onCount?.(usage.snapshot());
    },
    stats() {
      return usage.snapshot();
    },
    prometheus() {
      return usage.prometheus();
    },
    metrics() {
      return usage.metrics();
    },
  };
}

function headersFrom(headers: HeaderInput | undefined): HeaderPair[] | undefined {
  if (!headers) return undefined;
  if (Array.isArray(headers)) return headers.map(([name, value]) => ({ name, value }));
  const out: HeaderPair[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) out.push({ name, value: item });
  }
  return out;
}

export function parseQuery(query: string): QueryPair[] {
  if (query.startsWith('?')) return parseQuery(query.slice(1));
  if (query === '') return [];
  return query.split('&').filter((part) => part.length > 0).map((part) => {
    const eq = part.indexOf('=');
    const rawName = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    return { name: decodeURIComponent(rawName.replace(/\+/g, ' ')), value: decodeURIComponent(rawValue.replace(/\+/g, ' ')) };
  });
}

export function supportedVersions(error: unknown): string[] {
  return error instanceof ApiversaError ? error.supportedVersions : [];
}
