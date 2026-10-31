import type { Direction } from './errors.js';
import { ApiversaError } from './errors.js';
import { loadBundle, type Bundle } from './bundle/load.js';
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
};

/**
 * Load `versions.yaml` and the change files in `dir`, and compile conversion plans.
 * Plans are fixed at startup. An empty plan does not parse the body.
 */
export function createApiversa(options: CreateOptions): Apiversa {
  const development = options.development ?? process.env.NODE_ENV !== 'production';
  const trace = options.trace === true || (development && options.trace !== false);
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
  return api(bundle, { header: options.header ?? 'Api-Version', resolve: options.resolve, development, trace });
}

export function api(
  bundle: Bundle,
  opts: { header: string; resolve?: (request: unknown) => string | undefined; development: boolean; trace: boolean },
): Apiversa {
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
