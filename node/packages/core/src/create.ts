import type { Direction } from './errors.js';
import { ApiversaError, fail } from './errors.js';
import { loadBundle, planFor, type Bundle } from './bundle/load.js';
import { clientHeaders, deprecationHeaders, endpointDeprecationHeaders, memoryPins, Usage, type CountSnapshot, type MetricPoint, type SafeToRemove } from './lifecycle.js';
import { clientField, clientValidation, type ClientField, type ClientIssue, type SchemaParser } from './clientField.js';

export type { ClientField, ClientIssue, SchemaParser };
export { memoryPins };
export type { CountSnapshot, MetricPoint, SafeToRemove };
export type { VersionSource };
import { bodyPlanEmpty, execute, type ExecuteResult } from './chain/run.js';
import { DEFAULT_LIMITS } from './limits.js';
import type { Converter, HeaderPair, PinStore, QueryPair } from './model.js';
import type { Registry } from './json/parse.js';
import { readHeader, resolveDecision, resolveVersion, type HeaderInput, type VersionSource } from './resolve/version.js';

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
  /** Called after each applied change. The hook must not open a socket. */
  onConvert?: (event: { change: string; direction: Direction; ms: number }) => void;
  /** UTC date for sunset enforcement. Tests set this and do not read the clock. */
  now?: string;
  /** Old URL prefixes mapped to dates, for example `{ '/v1': '2025-10-01' }`. A version header and a resolver both win over a prefix. */
  legacyPrefixes?: Record<string, string>;
};

export type Apiversa = {
  /** Resolve the client version: header, host resolver, then the bundle default. */
  resolveVersion(input: { headers?: HeaderInput; request?: unknown; clientId?: string; path?: string }): string;
  /** Same resolution as {@link Apiversa.resolveVersion}, plus which rule won and the response headers to set. */
  resolveDecision(input: { headers?: HeaderInput; request?: unknown; clientId?: string; path?: string }): { version: string; source: VersionSource; headers: { name: string; value: string }[] };
  /** Upgrade a request body to head. Returns the original reference when the plan is empty. */
  convertRequest(input: ConvertInput): unknown;
  /** Downgrade a response body from head. Returns the original reference when the plan is empty. */
  convertResponse(input: ConvertInput): unknown;
  /** Full request or response conversion, including path, query, headers, and trace. */
  prepare(direction: Direction, input: ConvertInput): ExecuteResult;
  /** True when this version and schema need no body parse. */
  planIsEmpty(version: string, schema: string | undefined, direction: Direction, route?: { method?: string; path?: string }): boolean;
  /** Head path translated into the client's field name. A later field is `_head`. */
  clientField(version: string, schema: string, headPath: string): ClientField;
  /** Head-schema issues, rewritten for the client. A passing parse returns undefined. */
  clientValidation(version: string, schema: string, body: unknown, parser: SchemaParser): ClientIssue[] | undefined;
  /** Outgoing event in that version's shape. Same `down` chain as a response. */
  downgradeEvent(payload: unknown, schema: string, version: string): unknown;
  /** Downgrade using the subscriber's pin. A missing pin is AV-E002. */
  downgradeForSubscriber(payload: unknown, schema: string, subscriberId: string): unknown;
  /** Incoming event brought up to head. Same `up` chain as a request. */
  upgradeEvent(payload: unknown, schema: string, version: string): unknown;
  /** Deprecation, Sunset, and Link for a deprecated version. Empty when it is not deprecated. */
  deprecationHeaders(version: string): { name: string; value: string }[];
  /** Deprecation, Sunset, and Link for one deprecated route. Empty when that route is gone or not marked. */
  endpointDeprecationHeaders(version: string, method: string | undefined, path: string | undefined): { name: string; value: string }[];
  /** Older HTTP methods that `endpoint.method` sends to this head method and path. */
  methodShims(headMethod: string, path: string): string[];
  /** Count one request. A client id is counted only when the caller has one. */
  note(version: string, clientId?: string, extra?: { unpinned?: boolean; endpoint?: string }): void;
  /** Versions and changes with no requests in this process. */
  safeToRemove(): SafeToRemove;
  /** Changes between the client's pin and `toDate`, with one before/after sample. */
  previewUpgrade(clientId: string, toDate: string, sample?: unknown, schema?: string): { from: string; to: string; endpoints: { path: string; changes: { id: string; description: string; before: unknown; after: unknown }[] }[] };
  /** Move a pin forward. A backwards move needs `allowDowngrade`. `dryRun` does not write. */
  upgradePin(clientId: string, toDate: string, options?: { dryRun?: boolean; allowDowngrade?: boolean }): string;
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
    now: options.now,
    headerName: options.header,
  });
  return api(bundle, { header: options.header ?? 'Api-Version', resolve: options.resolve, development, trace, usage, onCount: options.onCount, onConvert: options.onConvert, legacyPrefixes: options.legacyPrefixes });
}

export function api(
  bundle: Bundle,
  opts: { header: string; resolve?: (request: unknown) => string | undefined; development: boolean; trace: boolean; usage?: Usage; onCount?: (snapshot: CountSnapshot) => void; onConvert?: (event: { change: string; direction: Direction; ms: number }) => void; legacyPrefixes?: Record<string, string> },
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
      : resolveVersion(bundle, { headers: input.headers, headerName: opts.header, resolved: hostVersion(input), clientId: input.clientId, path: input.path, legacyPrefixes: opts.legacyPrefixes });
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
        onConvert: opts.onConvert,
      },
      direction,
    );
  }
  return {
    resolveVersion(input) {
      return resolveVersion(bundle, { headers: input.headers, headerName: opts.header, resolved: hostVersion(input), clientId: input.clientId, path: input.path, legacyPrefixes: opts.legacyPrefixes });
    },
    resolveDecision(input) {
      const decision = resolveDecision(bundle, { headers: input.headers, headerName: opts.header, resolved: hostVersion(input), clientId: input.clientId, path: input.path, legacyPrefixes: opts.legacyPrefixes });
      return { ...decision, headers: clientHeaders(opts.header, decision.version, decision.source) };
    },
    convertRequest(input) {
      return prepare('up', input).body;
    },
    convertResponse(input) {
      return prepare('down', input).body;
    },
    prepare,
    planIsEmpty(version, schema, direction, route) {
      return bodyPlanEmpty(bundle, version, schema, direction, route);
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
    upgradeEvent(payload, schema, version) {
      return prepare('up', { schema, body: payload, version }).body;
    },
    deprecationHeaders(version) {
      return deprecationHeaders(bundle, version);
    },
    endpointDeprecationHeaders(version, method, path) {
      return endpointDeprecationHeaders(bundle, version, method, path);
    },
    methodShims(headMethod, path) {
      const froms: string[] = [];
      for (const change of bundle.changes) {
        for (const op of change.ops) {
          if (op.op !== 'endpoint.method' || op.to !== headMethod || op.path !== path || !op.from) continue;
          if (!froms.includes(op.from)) froms.push(op.from);
        }
      }
      return froms;
    },
    note(version, clientId, extra) {
      const ids = [...new Set(planFor(bundle, version, 'up').map((step) => `${step.version}.${step.id}`))];
      usage.record(version, clientId, ids, extra);
      opts.onCount?.(usage.snapshot());
    },
    safeToRemove() {
      return usage.safeToRemove(bundle.dates, bundle.changes);
    },
    previewUpgrade(clientId, toDate, sample = {}, schema = 'Hotel') {
      const pin = clientId ? bundle.pins?.get(clientId) : undefined;
      if (!bundle.pins || !clientId || !pin) throw fail('AV-E002', 'up', 'no pin', bundle.dates);
      const to = resolveVersion(bundle, { headers: { [opts.header]: toDate }, headerName: opts.header });
      const changes = bundle.changes
        .filter((change) => change.version > pin && change.version <= to)
        .sort((left, right) => left.version.localeCompare(right.version) || left.id.localeCompare(right.id))
        .map((change) => ({
          id: `${change.version}.${change.id}`,
          description: change.description,
          before: prepare('down', { schema, body: sample, version: pin }).body,
          after: to === bundle.head ? sample : prepare('down', { schema, body: sample, version: to }).body,
        }));
      const paths = usage.pathsFor(clientId);
      const endpoints = (paths.length > 0 ? paths : ['*']).map((path) => ({ path, changes }));
      return { from: pin, to, endpoints };
    },
    upgradePin(clientId, toDate, options) {
      if (!bundle.pins || !clientId) throw fail('AV-E002', 'up', 'no pin', bundle.dates);
      const pin = bundle.pins.get(clientId);
      if (!pin) throw fail('AV-E002', 'up', 'no pin', bundle.dates);
      const to = resolveVersion(bundle, { headers: { [opts.header]: toDate }, headerName: opts.header });
      if (to < pin && !options?.allowDowngrade) throw new Error('Refusing to move a pin backwards without allowDowngrade.');
      if (!options?.dryRun) bundle.pins.set(clientId, to);
      return to;
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
