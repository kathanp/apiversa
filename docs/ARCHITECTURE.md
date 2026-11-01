# Architecture

apiversa is a library that runs inside an API server. The host app writes handlers for the newest API version only. apiversa converts each request from the client's pinned version up to the head, and each response from the head back down to the client's version, using change files. It does not run old handlers (except `endpoint.remove` legacy handlers the host keeps), does not proxy traffic, and does not call the network.

Current versions: **node 0.1.0** and **spring 0.1.0** (both in progress, not yet published). A direct request for a version covers both tracks through merge and publish. The guard checks that these match `node/packages/core/package.json` and `spring/pom.xml`.

The Node core (`apiversa`) has no runtime dependencies. Framework adapters list their framework as a peer dependency. The Java core (`apiversa-core-java`) depends only on Jackson and SnakeYAML Engine. Both read the same change files and must produce byte-identical output.

## Path of one request

1. The adapter (Express, Fastify, NestJS, Hono, Spring MVC, or Spring WebFlux) sees the request on a route registered with apiversa. Unregistered routes are untouched.
2. The resolver finds the version: `Api-Version` header → host resolver (for example the API key's pin) → the `default` policy. Unknown, future, or retired dates end here with `AV-E002`, `AV-E003`, or `AV-E012`.
3. Head version: nothing else happens (PERF-01). The handler runs.
4. Older version: the precompiled plan for (route, version) runs the `up` operations of every newer change, oldest first, on the request body, headers, and path. A form body's text fields take the same ops. A file part is copied. Keys `__proto__`, `constructor`, `prototype` are dropped.
5. The handler runs once, at head. When the head schema rejects the upgraded request, the error paths are translated back to the client's field names. A field the client never had is reported as `_head`.
6. The plan runs the `down` operations of the same changes, newest first, on the response body (or error body). Arrays and paginated lists convert item by item. Streams convert per line or event.
7. Deprecated versions get `Deprecation`, `Sunset`, and `Link` headers. Counters record the version and each change used.

Outgoing webhooks use the same `down` path through `downgradeEvent`. A Kafka consumer upgrades the record value from the `Api-Version` header. A producer downgrades it. SQS and RabbitMQ call that same header-map conversion.

## Layout

| Path                                   | Role                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| `docs/`                                | Spec, autopilot, rules, architecture, history, user docs     |
| `scripts/`                             | `guard.mjs` gates and `scheduler.mjs` timer                  |
| `schema/`                              | `change-file.schema.json`, shared by Node and Spring         |
| `conformance/`                         | Language-neutral cases both libraries must pass              |
| `examples/`                            | Runnable example apps and smoke tests                        |
| `bench/`                               | Benchmark script and result files                            |
| `.cursor/rules/`                       | Cursor rule files                                            |
| `node/packages/core/src/bundle/`       | `versions.yaml` loader and validation                        |
| `node/packages/core/src/yaml/`         | Safe YAML subset parser                                      |
| `node/packages/core/src/json/`         | Canonical JSON parse and encode                              |
| `node/packages/core/src/path/`         | Change-file path walks                                       |
| `node/packages/core/src/expr/`         | Change-file expressions                                      |
| `node/packages/core/src/schema/`       | Change-file JSON Schema check                                |
| `node/packages/core/src/ops/`          | One file per operation                                       |
| `node/packages/core/src/chain/`        | Plan compiler and up/down chains                             |
| `node/packages/core/src/resolve/`      | Version resolution and pin stores interface                  |
| `node/packages/core/src/cli/`          | `apiversa` command                                           |
| `node/packages/express/`               | Express adapter                                              |
| `node/packages/fastify/`               | Fastify adapter                                              |
| `node/packages/nest/`                  | NestJS adapter                                               |
| `node/packages/hono/`                  | Hono adapter                                                 |
| `node/packages/zod/`                   | Zod registry                                                 |
| `spring/apiversa-core-java/`           | Java loader, ops, chains                                     |
| `spring/apiversa-spring-boot-starter/` | Auto-configuration and MVC advice                            |
| `spring/apiversa-springdoc/`           | OpenAPI groups per version                                   |
| `spring/apiversa-test/`                | JUnit 5 and MockMvc helpers                                  |
| `spring/apiversa-maven-plugin/`        | Maven goals `check`, `changelog`, `lock`, and `init`      |
| `spring/apiversa-micrometer/`          | Request and conversion counters as Micrometer meters        |
| `spring/apiversa-actuator/`            | Read-only `/actuator/apiversa`                               |
| `spring/apiversa-webflux/`             | WebFlux filter: same conversion, plus NDJSON and SSE lines   |
| `spring/apiversa-kafka/`               | Kafka records and queue message conversion                   |
| `spring/apiversa-kotlin/`              | Kotlin converter DSL and client-field extension              |

Rows marked (planned) do not exist yet. When the agent creates a path, it removes "(planned)" from that row in the same commit. The guard fails on a row that names a missing path without "(planned)".

## Design choices that matter

- **Change files target schemas, not routes.** One change on `Hotel` fixes every endpoint that returns a hotel.
- **Plans are compiled at startup.** Request time does no path parsing.
- **Declarative YAML first, code second.** YAML ops are portable between Node and Java. `custom` converters are the escape hatch and are typed per version in TypeScript.
- **Canonical JSON** (spec B7) makes Node and Java output byte-identical: registry key order, then unknown keys, ECMA-262 numbers and string escaping, duplicate keys rejected. An empty plan does not re-encode the body.

## What is deliberately absent

No proxy mode, no network calls, no telemetry, no AI, no GraphQL versioning, no automatic change files (drafts only), no hosted dashboard.
