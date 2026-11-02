# Changelog

One section per track and version, newest version first. Node and Spring are interleaved by version number. The agent adds one line per finished roadmap ID while building (`- <ID> <title>`). A release renames `(unreleased)` to the release date. Each section has a migration line (`docs/STABILITY.md`).

## node 0.22.0 (unreleased)

- FW-03 NestJS adapter
- Migration: none. The same module runs on Nest 10 and Nest 11, with Express and Fastify. Nest 10 is installed outside the workspace in `nest10-check/` so it does not replace Nest 11.

## spring 0.16.0 (unreleased)

- SPR-03 Version resolution
- SPR-14 Maven plugin
- CORE-10 Released versions are frozen
- Migration: a `prod` or `production` profile now fails startup with `AV-E006` when `.lock.json` does not match the change files. `mvn apiversa:check` fails when `head.json` differs from the newest `snapshots/*.json` and no non-draft change file covers that diff. Framework 7 apps depend on `apiversa-spring-framework7`, which delegates `ApiVersionResolver` to `Engine.resolve`. Boot 3.3 keeps its own resolver.
- Known gap: MVC converts form bodies, and a repeated form key still keeps the last value, so CORE-14 stays unchecked (D-41). The native image was not built, so SPR-11 stays unchecked.

## node 0.21.0 (unreleased)

- CORE-24 Op scope
- CORE-25 Response envelope
- CORE-26 Value prefix
- Migration: none until a change file sets `scope`, `response.envelope`, or `value.prefix`. Those ops are `AV-E001` on older releases.

## node 0.20.0 (unreleased)

- SHR-04 Request-level conformance cases
- CORE-22 Method change
- CORE-23 Parameter relocation
- CORE-27 Endpoint deprecation
- Migration: none until a change file uses `endpoint.method`, `param.move`, or `endpoint.deprecate`.

## node 0.19.0 (unreleased)

- DBG-05 Step diff
- OBS-02 Unpinned counter
- DOC-07 Upgrade matrix
- Migration: `stats()` still omits `unpinned` until a default-policy request increments it (D-50).

## node 0.18.0 (unreleased)

- CORE-21 Discriminator binding
- EVT-04 Upgrade an incoming event
- DOC-06 Webhooks in per-version OpenAPI
- Migration: none until a schema stores a discriminator. A discriminator path is one object key (D-51).

## node 0.17.0 (unreleased)

- CORE-18 Header add and remove
- CORE-19 Link rewrite
- CORE-20 Field deprecation marker
- Migration: none until a change file uses `header.add`, `header.remove`, `link.rewrite`, or `field.deprecate`.

## node 0.16.0 (unreleased)

- CORE-16 Response version header
- CORE-17 Unpinned-client header
- LIFE-08 Sunset enforcement
- Migration: responses on a registered route now include `Api-Version`. `Apiversa-Default` is added only when the default policy chose the date. A sunset with `sunsetEnforce: true` returns `AV-E012`.

## spring 0.15.0 (unreleased)

- CORE-24 Op scope
- CORE-25 Response envelope
- CORE-26 Value prefix
- Migration: same as node 0.21.0.

## node 0.15.0 (unreleased)

- CLIENT-01 Typed client
- CLIENT-02 React hook
- SHR-03 Cross-implementation gate
- DOC-05 Type diff per version
- Migration: none. The client and the React hook are new packages.

## spring 0.14.0 (unreleased)

- SHR-04 Request-level conformance cases
- CORE-22 Method change
- CORE-23 Parameter relocation
- CORE-27 Endpoint deprecation
- Migration: same as node 0.20.0.

## node 0.14.0 (unreleased)

- FW-05 Next.js adapter
- FW-06 Koa adapter
- TYPE-05 TypeBox and JSON Schema
- TEST-07 Traffic replay
- Migration: none. Next.js uses a wrapper per route handler (`node/packages/next/test/next.test.ts`).

## spring 0.13.0 (unreleased)

- DBG-05 Step diff
- OBS-02 Unpinned counter
- DOC-07 Upgrade matrix
- Migration: same as node 0.19.0.

## node 0.13.0 (unreleased)

- LIFE-03 Safe-to-remove report
- LIFE-04 Retire a version
- LIFE-06 Pin upgrade with preview
- LIFE-07 Postgres pin store
- Migration: `apiversa retire` refuses a date that still has traffic unless you pass `--force` (D-49).

## spring 0.12.0 (unreleased)

- CORE-21 Discriminator binding
- EVT-04 Upgrade an incoming event
- DOC-06 Webhooks in per-version OpenAPI
- Migration: same as node 0.18.0.

## node 0.12.0 (unreleased)

- OBS-01 Tracing
- DBG-02 Explain
- DBG-03 Logging hook
- PERF-03 Benchmark script
- Migration: none. Tracing is a separate package and adds no span on a head request.

## spring 0.11.0 (unreleased)

- CORE-18 Header add and remove
- CORE-19 Link rewrite
- CORE-20 Field deprecation marker
- Migration: same as node 0.17.0.

## node 0.11.0 (unreleased)

- ADOPT-01 Existing /v1, /v2
- ADOPT-03 Eject
- DOC-04 Upgrade guide per client
- Migration: none until you set `legacyPrefixes`. Unregistered routes stay untouched.

## spring 0.10.0 (unreleased)

- CORE-16 Response version header
- CORE-17 Unpinned-client header
- LIFE-08 Sunset enforcement
- Migration: same as node 0.16.0.

## node 0.10.0 (unreleased)

- LIFE-01 Deprecation and Sunset headers
- LIFE-02 Usage counters
- LIFE-05 Pin stores (memory, Redis)
- Migration: a deprecated version now sends `Deprecation`, `Sunset`, and `Link`. Counters stay in the process until you call `stats()`.

## spring 0.9.0 (unreleased)

- SHR-03 Cross-implementation gate
- TEST-07 Traffic replay
- Migration: none. `mvn apiversa:replay` reads a JSONL file you supply. It does not send the file anywhere.

## node 0.9.0 (unreleased)

- EVT-01 Downgrade an outgoing event
- EVT-02 Subscriber pins
- Migration: a webhook with no subscriber pin fails with `AV-E002`. Pass a pin before you call `downgradeForSubscriber`.

## spring 0.8.0 (unreleased)

- SPR-11 GraalVM native image
- SPR-12 Kotlin
- Migration: Kotlin converters are opt-in. Java callers do not change.
- Known gap: the native image was not built. `examples/spring-native` passed on the JVM. SPR-11 is still open (D-31).

## node 0.8.0 (unreleased)

- CORE-15 Validation errors in the client's terms
- TEST-02 Contract fixtures
- TEST-03 Change coverage
- Migration: a head validation error on an old request now names the client's field. A field the client never had is reported as `_head`.

## spring 0.7.0 (unreleased)

- CORE-14 Form bodies
- TEST-08 Fuzz suite
- Migration: none for JSON routes.
- Known gap: this version did not switch MVC form converters. spring 0.16.0 does. A repeated form key still keeps the last value, so CORE-14 stays unchecked (D-41).

## node 0.7.0 (unreleased)

- STR-01 Lists and pagination
- STR-02 NDJSON and SSE
- CORE-14 Form bodies
- Migration: a page's `data` items convert one by one. `next_cursor` is left as sent. Form text fields use the same ops as JSON. A repeated form key is `AV-E015` (D-41). Code that still keeps the last urlencoded value does not meet that rule yet.

## spring 0.6.0 (unreleased)

- SPR-07 Kafka messages
- EVT-03 Message queues
- Migration: a Kafka record converts from the `Api-Version` header. A missing header follows the default policy on the way in and is `AV-E002` when a subscriber pin is required.

## node 0.6.0 (unreleased)

- FW-03 NestJS adapter
- FW-04 Hono adapter
- Migration: Nest opts in with `ApiversaRoute`. Hono reads the upgraded body from `c.get('apiversaBody')`.
- Known gap: this version ran the Nest suite on Nest 11 only. Nest 10 is covered on node 0.22.0 (FW-03).

## spring 0.5.0 (unreleased)

- SPR-06 WebFlux
- STR-02 NDJSON and SSE
- Migration: WebFlux uses the same `apiversa.*` settings. NDJSON and SSE convert one line at a time.

## node 0.5.0 (unreleased)

- DOC-01 OpenAPI per version
- DOC-02 Version picker
- DOC-03 API changelog
- Migration: none until you run `apiversa openapi` or `apiversa changelog`. Handlers do not change.

## spring 0.4.0 (unreleased)

- LIFE-01 Deprecation and Sunset headers
- LIFE-03 Safe-to-remove report
- LIFE-06 Pin upgrade with preview
- Migration: same headers as node 0.10.0. `previewUpgrade` does not write a pin. `upgradePin` refuses a backwards move unless `allowDowngrade` is true.

## node 0.4.0 (unreleased)

- TEST-01 Breaking-change gate
- TEST-04 Pull-request summary
- TEST-06 Draft suggestion
- Migration: `apiversa check` fails the build when `head.json` differs from the newest snapshot and no change file covers the diff.

## spring 0.3.0 (unreleased)

- SPR-10 Bean Validation errors
- EVT-01 Downgrade an outgoing event
- EVT-02 Subscriber pins
- Migration: Bean Validation paths are mapped back through rename and move. A field added later is `_head` plus the head path.

## node 0.3.0 (unreleased)

- TYPE-02 Generated per-version schemas
- TYPE-03 Typed converters
- TYPE-04 Round-trip property tests
- Migration: `apiversa generate` rewrites top-level field ops into older Zod files. Nested paths stay on the head field list. There is no published example of the compile-time check yet (`docs/COMPARISON.md`).

## spring 0.2.0 (unreleased)

- SPR-13 Actuator endpoint
- SPR-08 Micrometer
- Migration: `/actuator/apiversa` is read-only. Micrometer meters stay on the caller's registry and are not exported.

## node 0.2.0 (unreleased)

- CORE-08 Error bodies
- CORE-10 Released versions are frozen
- CORE-11 Purity check
- CORE-13 Query parameters
- TEST-08 Fuzz suite
- DBG-04 Doctor
- Migration: production startup (`NODE_ENV=production`) fails with `AV-E006` when a locked change file changed. A repeated query key is `AV-E015` (D-41).

## spring 0.1.0 (unreleased)

- SPR-01 Platform
- SPR-02 Same change files
- SPR-03 Version resolution
- SPR-04 Conversion
- SPR-05 OpenAPI per version
- SPR-09 Test support
- SPR-14 Maven plugin
- CORE-01 Version bundle
- CORE-02 Version resolution
- CORE-03 Change-file loader
- CORE-04 Conversion chains
- CORE-05 Declarative operations
- CORE-06 Paths
- CORE-07 Schema binding
- ADOPT-02 Per-route opt-in
- ADOPT-04 Init
- DBG-01 Trace header
- PERF-01 Head fast path
- PERF-02 Precompiled plans
- SHR-01 Change-file JSON Schema
- SHR-02 Conformance suite (core ops)
- CORE-08 Error bodies
- CORE-09 Version errors
- CORE-12 Limits
- CORE-13 Query parameters
- STR-01 Lists and pagination
- Migration: add `apiversa-spring-boot-starter` and register each schema with an ordered field list before the first request. Unannotated routes are untouched.
- Known gaps at this version were closed on spring 0.16.0: the Framework 7 resolver (SPR-03), the Maven head diff (SPR-14), and the production lock read (CORE-10).

## node 0.1.0 (unreleased)

- CORE-01 Version bundle
- CORE-02 Version resolution
- CORE-03 Change-file loader
- CORE-04 Conversion chains
- CORE-05 Declarative operations
- CORE-06 Paths
- CORE-07 Schema binding
- CORE-09 Version errors
- CORE-12 Limits
- TYPE-01 Head schemas (Zod)
- FW-01 Express adapter
- FW-02 Fastify adapter
- ADOPT-02 Per-route opt-in
- ADOPT-04 Init
- DBG-01 Trace header
- PERF-01 Head fast path
- PERF-02 Precompiled plans
- TEST-05 Test helpers
- SHR-01 Change-file JSON Schema
- SHR-02 Conformance suite (core ops)
- Migration: register a route with the adapter. Other routes are untouched. Fastify downgrades in `onSend` (D-20). `oversize: 'passthrough'` sends the head shape on the way up only (D-43).
