import { fail, type Direction } from '../errors.js';
import { DEFAULT_LIMITS, MAX_DEPTH, type Limits } from '../limits.js';
import { BANNED_KEYS, isArray, isObject, jObject, setKey, type JArray, type JObject, type JValue } from './value.js';

const SAFE = 9007199254740991n;

function syntax(detail: string): never {
  throw new SyntaxError(detail);
}

/** Parse a JSON number token. Integers outside ±(2^53−1) and non-finite numbers are AV-E014. */
export function numberFromToken(token: string, when: Direction): number {
  if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(token)) {
    throw fail('AV-E014', when, `bad number token ${token}`);
  }
  const integer = /^-?(0|[1-9][0-9]*)$/.test(token);
  if (integer) {
    const neg = token.startsWith('-');
    const digits = neg ? token.slice(1) : token;
    const magnitude = BigInt(digits);
    if (magnitude > SAFE) throw fail('AV-E014', when, token);
    return Number(token);
  }
  const n = Number(token);
  if (!Number.isFinite(n)) throw fail('AV-E014', when, token);
  if (Number.isInteger(n) && !Number.isSafeInteger(n)) throw fail('AV-E014', when, token);
  return n;
}

export function checkJsNumber(n: number, when: Direction): number {
  if (!Number.isFinite(n) || Object.is(n, -0)) {
    if (Object.is(n, -0)) return 0;
    throw fail('AV-E014', when, String(n));
  }
  if (Number.isInteger(n) && !Number.isSafeInteger(n)) throw fail('AV-E014', when, String(n));
  return n;
}

export type ParseOptions = {
  when: Direction;
  limits?: Limits;
};

export function parseJson(text: string, options: ParseOptions): JValue {
  const limits = options.limits ?? DEFAULT_LIMITS;
  if (Buffer.byteLength(text) > limits.maxBodyBytes) throw fail('AV-E008', options.when);
  const p = new Parser(text, options.when, limits);
  const value = p.parseValue();
  p.skip();
  if (!p.eof()) throw syntax('trailing JSON');
  return value;
}

class Parser {
  private i = 0;
  private depth = 0;

  constructor(
    private readonly s: string,
    private readonly when: Direction,
    private readonly limits: Limits,
  ) {}

  eof(): boolean {
    return this.i >= this.s.length;
  }

  parseValue(): JValue {
    this.skip();
    if (this.eof()) throw syntax('empty JSON');
    const c = this.s[this.i]!;
    if (c === '{') return this.object();
    if (c === '[') return this.array();
    if (c === '"') return this.string();
    if (c === 't') return this.literal('true', true);
    if (c === 'f') return this.literal('false', false);
    if (c === 'n') return this.literal('null', null);
    if (c === '-' || (c >= '0' && c <= '9')) return this.number();
    throw syntax(`bad JSON at ${this.i}`);
  }

  skip(): void {
    while (this.i < this.s.length && this.s[this.i]! <= ' ') this.i += 1;
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw fail('AV-E004', this.when);
  }

  private leave(): void {
    this.depth -= 1;
  }

  private object(): JObject {
    this.enter();
    this.i += 1;
    const obj = jObject();
    const seen = new Set<string>();
    this.skip();
    if (this.s[this.i] === '}') {
      this.i += 1;
      this.leave();
      return obj;
    }
    for (;;) {
      this.skip();
      if (this.s[this.i] !== '"') throw syntax('object key');
      const key = this.string();
      if (seen.has(key)) throw fail('AV-E015', this.when, key);
      seen.add(key);
      this.skip();
      if (this.s[this.i] !== ':') throw syntax('expected colon');
      this.i += 1;
      const value = this.parseValue();
      if (!BANNED_KEYS.has(key)) setKey(obj, key, value);
      this.skip();
      const n = this.s[this.i];
      if (n === ',') {
        this.i += 1;
        continue;
      }
      if (n === '}') {
        this.i += 1;
        break;
      }
      throw syntax('object end');
    }
    this.leave();
    return obj;
  }

  private array(): JArray {
    this.enter();
    this.i += 1;
    const items: JValue[] = [];
    this.skip();
    if (this.s[this.i] === ']') {
      this.i += 1;
      this.leave();
      return { kind: 'array', items };
    }
    for (;;) {
      items.push(this.parseValue());
      if (items.length > this.limits.maxArrayItems) throw fail('AV-E009', this.when);
      this.skip();
      const n = this.s[this.i];
      if (n === ',') {
        this.i += 1;
        continue;
      }
      if (n === ']') {
        this.i += 1;
        break;
      }
      throw syntax('array end');
    }
    this.leave();
    return { kind: 'array', items };
  }

  private string(): string {
    this.i += 1;
    let out = '';
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === '"') {
        this.i += 1;
        return out;
      }
      if (c === '\\') {
        this.i += 1;
        const e = this.s[this.i];
        if (e === undefined) throw syntax('bad escape');
        const map: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (map[e] !== undefined) {
          out += map[e];
          this.i += 1;
          continue;
        }
        if (e === 'u') {
          const hex = this.s.slice(this.i + 1, this.i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw syntax('bad unicode escape');
          out += String.fromCharCode(Number.parseInt(hex, 16));
          this.i += 5;
          continue;
        }
        throw syntax('bad escape');
      }
      if (c < ' ') throw syntax('raw control in string');
      out += c;
      this.i += 1;
    }
    throw syntax('unterminated string');
  }

  private literal(word: string, value: JValue): JValue {
    if (this.s.slice(this.i, this.i + word.length) !== word) throw syntax(word);
    this.i += word.length;
    return value;
  }

  private number(): number {
    const start = this.i;
    if (this.s[this.i] === '-') this.i += 1;
    if (this.s[this.i] === '0') this.i += 1;
    else {
      if (!this.digit()) throw syntax('number');
      while (this.digit()) this.i += 1;
    }
    if (this.s[this.i] === '.') {
      this.i += 1;
      if (!this.digit()) throw syntax('fraction');
      while (this.digit()) this.i += 1;
    }
    if (this.s[this.i] === 'e' || this.s[this.i] === 'E') {
      this.i += 1;
      if (this.s[this.i] === '+' || this.s[this.i] === '-') this.i += 1;
      if (!this.digit()) throw syntax('exponent');
      while (this.digit()) this.i += 1;
    }
    return numberFromToken(this.s.slice(start, this.i), this.when);
  }

  private digit(): boolean {
    const c = this.s[this.i];
    return c !== undefined && c >= '0' && c <= '9';
  }
}

/** Adopt an already-parsed JSON value. Duplicate keys cannot occur. Banned keys are dropped. */
export function fromPlain(value: unknown, when: Direction, limits: Limits = DEFAULT_LIMITS, depth = 0): JValue {
  if (depth > MAX_DEPTH) throw fail('AV-E004', when);
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return checkJsNumber(value, when);
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayItems) throw fail('AV-E009', when);
    return { kind: 'array', items: value.map((item) => fromPlain(item, when, limits, depth + 1)) };
  }
  if (typeof value === 'object') {
    const obj = jObject();
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (BANNED_KEYS.has(key)) continue;
      setKey(obj, key, fromPlain((value as Record<string, unknown>)[key], when, limits, depth + 1));
    }
    return obj;
  }
  throw fail('AV-E016', when, 'value is not JSON');
}

export function toPlain(value: JValue, schema: string | undefined, registry: Registry, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw fail('AV-E004', 'down');
  if (!isObject(value) && !isArray(value)) return value;
  if (isArray(value)) {
    const itemSchema = undefined;
    return value.items.map((item) => toPlain(item, itemSchema, registry, depth + 1));
  }
  const def = schema ? registry[schema] : undefined;
  const keys = orderKeys(value, def);
  const out = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const child = value.values.get(key);
    if (child === undefined) continue;
    const field = def?.fields?.find((f) => f.name === key);
    const nextSchema = field?.schema;
    if (field?.items && isArray(child)) {
      out[key] = child.items.map((item) => toPlain(item, field.items, registry, depth + 1));
    } else {
      out[key] = toPlain(child, nextSchema, registry, depth + 1);
    }
  }
  return out;
}

export type SchemaField = { name: string; schema?: string; items?: string };
export type SchemaDef = { fields?: SchemaField[] };
export type Registry = Record<string, SchemaDef>;

export function orderKeys(obj: JObject, def: SchemaDef | undefined): string[] {
  const present = obj.keys.filter((k) => obj.values.has(k));
  if (!def?.fields) return present;
  const names = def.fields.map((f) => f.name);
  const known = new Set(names);
  const out: string[] = [];
  for (const name of names) if (obj.values.has(name)) out.push(name);
  for (const key of present) if (!known.has(key)) out.push(key);
  return out;
}
