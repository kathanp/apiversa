/**
 * apiversa core. No runtime dependencies.
 * Framework adapters and Zod registration live in their own packages.
 */
export { createApiversa, parseQuery, type Apiversa, type ConvertInput, type CreateOptions } from './create.js';
export { ApiversaError, MESSAGES, type ErrorCode } from './errors.js';
export type { Converter, HeaderPair, PinStore, QueryPair } from './model.js';
export type { Registry, SchemaDef, SchemaField } from './json/parse.js';
export { buildBundle, loadBundle } from './bundle/load.js';
export { init } from './cli/init.js';
export { toMatchVersion } from './testing.js';
