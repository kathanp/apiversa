import type { Bundle } from './bundle/load.js';
import type { PinStore } from './model.js';

export type CountSnapshot = {
  requests: Record<string, number>;
  conversions: Record<string, number>;
  clients: Record<string, number>;
  /** Present only after a request was resolved by the default policy. */
  unpinned?: Record<string, number>;
};

export type SafeToRemove = { versions: string[]; changes: string[]; window: 'process'; windowDays: 30 };

export type MetricPoint = { name: string; attributes: Record<string, string>; value: number };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** In-memory pin store. Redis is `@apiversa/pin-redis`. */
export function memoryPins(): PinStore {
  const saved = new Map<string, string>();
  return {
    get(clientId) {
      return saved.get(clientId);
    },
    set(clientId, date) {
      saved.set(clientId, date);
    },
  };
}

/** RFC 9745 Deprecation, RFC 8594 Sunset, and a link to the upgrade guide. Empty when the version is current. */
export function deprecationHeaders(bundle: Bundle, version: string): { name: string; value: string }[] {
  const info = bundle.versionInfo.find((item) => item.date === version);
  if (!info?.deprecated) return [];
  const epoch = Date.parse(`${info.date}T00:00:00.000Z`) / 1000;
  const headers = [{ name: 'Deprecation', value: `@${epoch}` }];
  if (info.sunset) headers.push({ name: 'Sunset', value: rfc1123(info.sunset) });
  headers.push({ name: 'Link', value: '</apiversa/upgrade>; rel="deprecation"' });
  return headers;
}

/** Process-local counters. `prometheus` and `metrics` return text the host can scrape. This object does not open a socket. */
export class Usage {
  private readonly requests = new Map<string, number>();
  private readonly conversions = new Map<string, number>();
  private readonly clients = new Map<string, number>();
  private readonly unpinned = new Map<string, number>();
  private readonly endpoints = new Map<string, Set<string>>();

  record(version: string, clientId: string | undefined, changeIds: string[], extra?: { unpinned?: boolean; endpoint?: string }): void {
    this.requests.set(version, (this.requests.get(version) ?? 0) + 1);
    if (clientId) this.clients.set(clientId, (this.clients.get(clientId) ?? 0) + 1);
    for (const id of changeIds) this.conversions.set(id, (this.conversions.get(id) ?? 0) + 1);
    if (extra?.unpinned) this.unpinned.set(version, (this.unpinned.get(version) ?? 0) + 1);
    if (clientId && extra?.endpoint) {
      const set = this.endpoints.get(clientId) ?? new Set<string>();
      set.add(extra.endpoint);
      this.endpoints.set(clientId, set);
    }
  }

  pathsFor(clientId: string): string[] {
    return [...(this.endpoints.get(clientId) ?? new Set<string>())];
  }

  snapshot(): CountSnapshot {
    const base = { requests: mapOf(this.requests), conversions: mapOf(this.conversions), clients: mapOf(this.clients) };
    if (this.unpinned.size === 0) return base;
    return { ...base, unpinned: mapOf(this.unpinned) };
  }

  /** Versions with no requests in this process, and changes used only by those versions. */
  safeToRemove(dates: string[], changes: { version: string; id: string }[]): SafeToRemove {
    const idle = dates.filter((date) => (this.requests.get(date) ?? 0) === 0);
    const safeChanges: string[] = [];
    for (const change of changes) {
      const used = dates.some((date) => date < change.version && (this.requests.get(date) ?? 0) > 0);
      if (!used) safeChanges.push(`${change.version}.${change.id}`);
    }
    return { versions: idle, changes: safeChanges, window: 'process', windowDays: 30 };
  }

  prometheus(): string {
    return [
      renderCounter('apiversa_requests_total', 'version', this.requests),
      renderCounter('apiversa_conversions_total', 'change', this.conversions),
      renderCounter('apiversa_clients_total', 'client', this.clients),
      renderCounter('apiversa_unpinned_total', 'version', this.unpinned),
    ].filter((part) => part.length > 0).join('\n');
  }

  metrics(): MetricPoint[] {
    return [
      ...points('apiversa.requests', 'version', this.requests),
      ...points('apiversa.conversions', 'change', this.conversions),
      ...points('apiversa.clients', 'client', this.clients),
      ...points('apiversa.unpinned', 'version', this.unpinned),
    ];
  }
}

/** Echo the resolved date. `Apiversa-Default` is set only when the default policy chose it. */
export function clientHeaders(headerName: string, version: string, source: string): { name: string; value: string }[] {
  const headers = [{ name: headerName, value: version }];
  if (source === 'default') headers.push({ name: 'Apiversa-Default', value: version });
  return headers;
}

function mapOf(source: Map<string, number>): Record<string, number> {
  return Object.fromEntries(source);
}

function renderCounter(name: string, label: string, source: Map<string, number>): string {
  if (source.size === 0) return '';
  const lines = [`# TYPE ${name} counter`];
  for (const [key, value] of source) lines.push(`${name}{${label}="${key}"} ${value}`);
  return lines.join('\n');
}

function points(name: string, label: string, source: Map<string, number>): MetricPoint[] {
  return [...source].map(([key, value]) => ({ name, attributes: { [label]: key }, value }));
}

function rfc1123(date: string): string {
  const utc = new Date(`${date}T00:00:00.000Z`);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${DAYS[utc.getUTCDay()]}, ${pad(utc.getUTCDate())} ${MONTHS[utc.getUTCMonth()]} ${utc.getUTCFullYear()} 00:00:00 GMT`;
}
