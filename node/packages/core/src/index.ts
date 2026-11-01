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
export { generate, schemaFieldsAt, writeGenerated, type HeadField } from './cli/generate.js';
export { openApiVersions, versionPicker, writeOpenApi, type OpenApiDocument, type VersionPicker } from './cli/openapi.js';
export { changelogBundle, writeChangelog, type ChangelogDocument } from './cli/changelog.js';
export { toMatchVersion } from './testing.js';
export { downgradeNdjson, downgradeNdjsonLine, downgradeSse, downgradeSseLine } from './stream.js';
export { convertForm, type FormResult } from './form.js';
export { clientField, clientValidation, type ClientField, type ClientIssue, type SchemaParser } from './clientField.js';
export { memoryPins, type CountSnapshot, type MetricPoint } from './lifecycle.js';
export { testBundle, type ContractResult } from './cli/contract.js';
