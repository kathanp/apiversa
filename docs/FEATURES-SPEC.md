# apiversa — Features and Specification

|                 |                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Product         | `apiversa` — Stripe-style, date-based API versioning for Node.js and Spring                        |
| npm             | `apiversa` (core) and `@apiversa/*` (adapters). Name was free on npm on 2026-10-30. Trademark search not done |
| Maven           | `io.github.kathanp:apiversa-spring` (namespace must be verified on Maven Central first)           |
| Spec version    | 1.0, 2026-10-31                                                                                    |
| Node runtime    | Node.js ≥ 22. ESM + CJS builds. TypeScript types shipped. Zero runtime dependencies in core        |
| Java runtime    | Java ≥ 17. Spring Boot 3.3+ and 4.x. Spring MVC first, WebFlux later                               |
| License         | Apache-2.0                                                                                         |
| Author          | Kathan Patel                                                                                       |

**Status.** `[x]` means implemented and tested. Nothing is published yet.

| Track | Last version fully [x] | Open IDs | Published |
| --- | --- | --- | --- |
| node | 0.22.0 | none | no |
| spring | 0.16.0 | SPR-11 on spring 0.17.0 | no |

**How to read this file.** Part A says what the product is. Part B is the shared change-file contract both libraries implement: format, expressions, schema graph, chain order, canonical JSON, and failure behavior. Part C is every feature, with an ID, acceptance criteria, and what it refuses. Part D is the Node library. Part E is the Spring library. Part F is quality budgets and error codes. Part G is what is left out on purpose. **Part H, at the bottom, is the roadmap: which feature ships in which version.** `docs/VERSION-HISTORY.md` records what actually shipped. Where Part C, D, or E disagrees with Part B on order, encoding, absence, or errors, Part B wins.

**Rule for the agent.** Build only features listed in Part H for the version being built. A feature that is not in Part H is not built. To add one, follow the admission rule in H0.

**0.1.0 means both tracks.** When the owner says to build 0.1.0 (`go for 0.1.0`, the first version, or the same request in other words), implement the full **node 0.1.0** list and the full **spring 0.1.0** list in that same effort. Do not finish Node and stop. Both libraries follow Part B and the same conformance fixtures. Every behavior in node 0.1.0 is in spring 0.1.0. Express (FW-01) and Fastify (FW-02) are the Spring MVC advice (SPR-01, SPR-04). Zod field order (TYPE-01) is `ApiversaSchemas` and `@JsonPropertyOrder`. A scheduled autopilot slot still follows `docs/AUTOPILOT.md`. This rule is for a direct request to build 0.1.0.

**Next version means code, merge, and publish both tracks.** When the owner says to go for the next version, or names a version (`go for 0.2.0`), that request is done only when both packages have been through every step below. “Both packages” means the Node lockstep (`apiversa` and `@apiversa/*`) and the Spring artifacts (`io.github.kathanp:apiversa-*`). Take the version they named, or, if they did not name one, the lowest unshipped version of each track in Part H.

Do these in order, for Node and for Spring, before reporting the request done:

1. Implement every remaining Part H ID for that version. Tests first. One `feat` commit per ID.
2. Run the full gate, update `CHANGELOG.md` and the user-visible docs, and pass `node scripts/guard.mjs --verify-docs --verify-roadmap`.
3. Merge into `next` and push `next`. CI publishes the pre-release when it is green.
4. Meet the release bar in H0 rule 8 and `docs/AUTOPILOT.md` section 6, including the tarball smoke test for Node and the local Maven smoke test for Spring.
5. Date the changelog section, set the package version, and commit `release(<track>): <version>`.
6. Open a pull request from `next` to `main`, wait for the required checks, and merge with a merge commit. If branch protection requires a review, stop and say so. Do not bypass it.
7. Tag `main` with `node-v<version>` and `spring-v<version>` and push the tags. GitHub Actions publishes. Do not run `npm login` or `npm publish`.
8. Wait for both publish workflows and the stranger check, then record the versions in `docs/VERSION-HISTORY.md`.

`1.0.0` is a major version. Prepare it, open the pull request, and stop. The owner merges and tags a major. A scheduled autopilot slot still follows `docs/AUTOPILOT.md`, including its limit of three IDs. This list is for a direct request to take a version through to publish.

---

# PART A — PRODUCT

## A1. The problem

A public or mobile API changes. A field is renamed, a number becomes an object, an endpoint moves. Every old client breaks: partner integrations, and mobile apps that users never update. Teams answer with `/v1`, `/v2` folders, copy the handlers, fix every bug twice, and never delete anything.

## A2. The answer

1. Each client is pinned to a **date version**, for example `2026-01-15`.
2. The team writes code **only for the newest version** (the *head*).
3. Each breaking change is one small **change file**. It says what the previous version looked like and how to convert.
4. At runtime apiversa **upgrades** an old request to the head shape, the handler runs once, then apiversa **downgrades** the response back to the client's version, one change at a time.
5. apiversa also produces per-version OpenAPI, per-version TypeScript types, an API changelog, versioned webhooks, and a CI gate that fails when the head changes without a change file.

## A3. Who it is for

| Segment                                   | Why they need it                                                     |
| ----------------------------------------- | -------------------------------------------------------------------- |
| Mobile apps                               | Old app versions call the API for years and cannot be forced to update |
| Public APIs with partners                 | Payments, fintech, travel and booking, logistics, B2B SaaS          |
| Banks and enterprises with partner APIs   | Spring side. Slow change, strict compatibility                       |

Not for: internal APIs where the same team ships client and server together. Those teams do not need this.

## A4. What makes it different

| Capability | apiversa | Cadwyn (Python) | tsadwyn 0.1.0 | Spring 7 built-in | `/v1` folders |
| --- | --- | --- | --- | --- | --- |
| Write head only, convert old versions | yes | yes | yes | no (routes only) | no |
| Same change files in Node and Java | yes | no | no | no | no |
| Compile-time type check of each version | yes | unverified | unverified | unverified | unverified |
| CI gate: head changed without change file | yes | unverified | unverified | unverified | unverified |
| Versioned webhooks | yes | unverified | unverified | unverified | unverified |
| Usage per version and "safe to delete" report | yes | unverified | unverified | unverified | unverified |
| Express, Fastify, NestJS, Hono, Next.js | yes | FastAPI only | Express only | Spring only | any |

Checked 2026-11-01. Sources and the row-by-row re-check are in `docs/COMPARISON.md`. Re-check before quoting.

---

# PART B — THE CHANGE FILE (shared by Node and Spring)

Part B is the behavior contract. Both libraries implement this part the same way. A fixture in `conformance/fixtures/` is a test of this part, not of a framework.

## B1. Layout on disk

```
api-versions/
  versions.yaml                 # the ordered list of dates
  2026-03-01.price-object.yaml  # one file per change, named <date>.<slug>.yaml
  2026-03-01.price-object.ts    # optional code converter (Node)
  PriceObject.java              # optional code converter (Spring)
```

## B2. `versions.yaml`

```yaml
head: "2026-03-01"
versions:
  - date: "2026-03-01"
  - date: "2026-01-15"
    deprecated: true
    sunset: "2026-12-31"
  - date: "2025-10-01"
default: oldest          # latest | oldest | pin-on-first-call
```

- Dates are `YYYY-MM-DD`, strictly descending, no duplicates.
- `head` equals the first date.
- A date later than today (UTC) at startup is refused (`AV-E003`).

## B3. A change file

```yaml
version: "2026-03-01"
id: price-object
description: "Hotel.price changed from a number to {amount, currency}."
changes:
  - op: field.type
    schema: Hotel
    path: price
    down: { from: "price.amount" }                       # head -> 2026-01-15
    up:   { value: { amount: "$.price", currency: "USD" } } # 2026-01-15 -> head
```

The file describes how version `version` differs from the version **just before it**. `down` converts head-side data to the older shape. `up` converts older-side data to the newer shape. Two files with the same `version` and the same `id` fail at startup (`AV-E001`). The same `id` on two different dates is allowed: the identity of a change is `version` plus `id`.

## B4. Operations

Every operation is pure. It reads one JSON value and returns a new one.

| Op               | Down (new → old)                                 | Up (old → new)                                   | Required fields              |
| ---------------- | ------------------------------------------------ | ------------------------------------------------ | ---------------------------- |
| `field.rename`   | rename `to` back to `from`                       | rename `from` to `to`                            | `schema`, `from`, `to`       |
| `field.add`      | remove the key when its value equals `default` (B10) | set `default` when the key is absent; `null` stays `null` (B10) | `schema`, `path`, `default`  |
| `field.remove`   | set `default` when the key is absent (B10)       | delete the key when it is present, including `null` | `schema`, `path`, `default`  |
| `field.move`     | move `to` back to `from`                         | move `from` to `to`                              | `schema`, `from`, `to`       |
| `field.type`     | expression in `down`                             | expression in `up`                               | `schema`, `path`, `down`, `up` |
| `enum.add`       | map the new value to `fallback`                  | none                                             | `schema`, `path`, `value`, `fallback` |
| `enum.rename`    | rename value back                                | rename value                                     | `schema`, `path`, `from`, `to` |
| `enum.remove`    | none                                             | map the removed value to `replacement`           | `schema`, `path`, `value`, `replacement` |
| `object.wrap`    | unwrap                                           | wrap fields under `into`                         | `schema`, `fields`, `into`   |
| `endpoint.add`   | older versions get `404` (`AV-E010`)             | none                                             | `method`, `path`             |
| `endpoint.remove`| older versions still route to `legacyHandler`    | head returns `410` (`AV-E011`)                   | `method`, `path`, `legacyHandler` |
| `endpoint.rename`| older versions call the old path                 | old path is rewritten to the new path            | `method`, `from`, `to`       |
| `status.change`  | map status `to` back to `from`                   | none                                             | `method`, `path`, `from`, `to` |
| `header.rename`  | rename response header back                      | rename request header                            | `from`, `to`                 |
| `query.rename`   | none                                             | rename an old query parameter to the new name    | `method`, `path`, `from`, `to` |
| `query.add`      | none                                             | set `default` when the parameter is absent (B10) | `method`, `path`, `name`, `default` |
| `query.remove`   | none                                             | drop the parameter if an old client sent it      | `method`, `path`, `name`     |
| `error.shape`    | expression in `down` on error bodies             | none                                             | `code` or `status`, `down`   |
| `custom`         | named code converter                             | named code converter                             | `converter`                  |
| `header.add`     | remove the response header when its trimmed value equals `default` | set `default` on the request when the header is absent; an empty value stays empty | `name`, `default` |
| `header.remove`  | set `default` on the response when the header is absent | drop the request header when it is present, including an empty value | `name`, `default` |
| `link.rewrite`   | rewrite a string that matches `to` back to `from` | rewrite a string that matches `from` to `to`     | `schema`, `path`, `from`, `to` |
| `field.deprecate`| none                                             | none                                             | `schema`, `path`             |
| `endpoint.method`| none                                             | a request with `from` method on `path` is routed as `to` method | `path`, `from`, `to` |
| `param.move`     | none                                             | move one value between `path:`, `query:`, `header:`, `body:` locations | `method`, `path`, `from`, `to` |
| `response.envelope` | replace the page body with its `items` array; optionally copy `cursor` to a response header | none | `method`, `path`, `items` |
| `value.prefix`   | strip `prefix` from a matching string; with `numeric: true`, a digit-only safe-integer remainder becomes a number | add `prefix` to a string or number (canonical decimal, B7) | `target`, `prefix` |
| `endpoint.deprecate` | none                                          | none                                             | `method`, `path`             |

An op listed as "none" in one direction is skipped in that direction (B9). Equality in this table is canonical-byte equality (B7). Enum ops leave every non-matching value untouched, including `null` and an absent key.

Header equality is trimmed string equality, not JSON bytes (B12, B10). `field.deprecate` is "none" in both directions: the body plan skips it, and OpenAPI and the changelog still read it.

Route patterns use `:param`, as in `endpoint.rename`, and name the route as the older client calls it.

## B5. Paths and expressions

A path addresses a value inside one schema object.

- A segment is a name (`address`), a one-key wildcard (`*`), or a name plus `[]` (`rooms[]`). `.` separates segments.
- `[]` walks every array element from left to right. `*` walks that object's own keys in their current order. A `*` or `[]` that matches nothing is a no-op.
- Depth is the segment count. A path of 33 or more segments in a change file fails at startup with `AV-E004`. The same cap applies while walking a value: the 33rd segment fails that conversion with `AV-E004`.
- `path`, `from`, and `to` on field ops are paths relative to the schema root. They match the `path` syntax in `schema/change-file.schema.json`. They do not start with `$.`.

An expression produces one JSON value. Reads in one expression see the value that entered the op.

| Form | Meaning |
| --- | --- |
| A string that is `$.` plus a path (`$.price`, `$.rooms[].id`) | Read that path from the schema root. `$.` alone is the root. |
| `from: "<path>"` | The same read, without `$.`. This is the `field.type` down form. |
| Any other string | A literal string. |
| A number, boolean, or `null` | A literal. |
| An object or array | A template. Each leaf is an expression. Keys stay in the order written until the canonical encoding (B7). |
| `{"literal": "<string>"}` | A literal string, including one that starts with `$.`. |

The result of a `field.type` expression replaces the value at `path`. It does not merge. There are no function calls, no concatenation, and no regular expressions. Anything else is a `custom` converter.

When the op's target key is absent, a read that cannot be resolved is a no-op (CORE-05). When the target key is present and a read walks through a number, string, boolean, or `null` to reach the next segment, the conversion fails with `AV-E016`.

## B6. Schema graph

A change names a **schema** (`Hotel`), not a route. The registry is a graph of named schemas.

- Each schema has a name and an ordered field list. A field is a leaf, a nested named schema, or an array of a named schema (`items`).
- A route declares one schema for the request body and one for the response (Part D3, E3). Nested names come only from those field lists. Declaring `Booking.hotel` as `Hotel` is how one `Hotel` change converts `GET /bookings/:id` with no per-route code.
- An array field converts each element with its item schema. A paginated list is an ordinary schema whose items field is an array of the item schema (STR-01). There is no second list format.
- Node stores Zod object key order. Spring stores the order the schema was registered in, or the order in `@JsonPropertyOrder` when that annotation is present. The conversion path reads the stored list and does not reflect.
- A JSON object the graph does not name is still addressable by a path (B5). Ops for a named schema do not run on it.
- Cycles in the graph are allowed (`Hotel.parent` is a `Hotel`). JSON values are trees. The walk stops at 32 segments (`AV-E004`).
- When a schema has no field list (a conformance case that omits `fields`), that object keeps input key order, and a key created by an op is appended.
- A schema may store one discriminator: a path plus a map from string values to schema names. Variant changes run only for the matching name.
- CORE-24 may narrow a field, enum, or object op to listed routes and to `request` or `response`. With no `scope`, the op still runs everywhere the schema appears. `scope` does not make the change name a route.

## B7. Canonical JSON

Both libraries emit the same UTF-8 bytes for the same input, version, change files, and field lists. That is the conformance contract (SHR-02).

The encoding is compact: no BOM and no insignificant whitespace.

- Registry fields come first, in list order, including a registry field an op just created. Keys the schema does not declare follow them, in input order. A key an op creates that is not in the registry is appended after those. A nested named schema uses its own list. An object with no field list keeps input key order, and a created key is appended (B6).
- Keys `__proto__`, `constructor`, and `prototype` are removed at every object before any op runs. They are not errors and they are not emitted.
- Strings follow ECMA-262 JSON escaping. Escape `"`, `\`, and U+0000 through U+001F as `\u00XX`. Every other character is raw UTF-8, including non-ASCII and U+2028 and U+2029. Lone surrogates are preserved.
- A finite integer in the closed range ±(2^53−1) is decimal with no fraction and no exponent. `1.0` is `1`. `1e2` is `100`. `-0` is `0`.
- Any other finite number uses the ECMA-262 number-to-string conversion, the same conversion `JSON.stringify` uses.
- A non-finite number, or an integer outside ±(2^53−1), fails with `AV-E014`.
- A duplicate key in one object fails at parse with `AV-E015`. The last key does not win.
- `true`, `false`, and `null` are those tokens. Arrays keep their order.

Canonical bytes are written only when the plan runs at least one op. An empty plan, including every head request, does not parse or re-encode the body (PERF-01). A success case compares those bytes with the canonical bytes of `expected`. A failure case compares the error code.

## B8. Machine-checkable format

`schema/change-file.schema.json` is the JSON Schema for change files and `versions.yaml`. Both libraries validate every file against it at startup (`AV-E001`). The schema checks shape. B5–B12 check meaning.

## B9. Chain order

A change file dated D is the difference introduced at D. A client at version V selects every op in every change file whose date is strictly newer than V. Files dated on V are already part of the client's shape and are not applied.

`up` (old shape toward head) sorts the selected files by date ascending, then by `id` ascending using the slug's ASCII order. Inside a file, ops run in source order. `down` (head shape toward the client) runs that same sequence of ops in exact reverse. Skipped directions drop out and do not reorder the ops that remain.

Each op sees the value the previous op produced.

Two files on `2026-03-01` with ids `a-rename` and `b-add` run `a-rename` then `b-add` on the way up, and `b-add` then `a-rename` on the way down. Across dates the same rule holds: the oldest selected date is first on the way up, and `down` is the reverse of that list.

## B10. Absence and null

A missing key and JSON `null` are different. `null` is a present value.

| Op | Key absent | Key present, value `null` | Key present, other value |
| --- | --- | --- | --- |
| `field.add` up | write `default` | leave `null` | leave the value |
| `field.add` down | leave absent | leave `null` | remove the key only when the value's canonical bytes equal `default` |
| `field.remove` up | leave absent | remove the key | remove the key |
| `field.remove` down | write `default` | leave `null` | leave the value |
| `field.rename`, `field.move` | no-op | move the key, keep `null` | move the value |
| `field.type` | no-op | `AV-E016` if the expression reads through `null` | replace with the expression result |
| `query.add` | set `default` | — | an empty parameter value stays empty; it is not `default` |

`field.add` round-trips absent ↔ `default`, and round-trips `null`. It does not round-trip a client that sent a value whose canonical bytes equal `default`: `down` removes that key. `field.remove` restores `default`, not the client's original value.

`header.add` and `header.remove` follow that same absent and present table. A missing header is "absent." Headers have no JSON `null`. An empty header value is present and is not replaced by `default`. Comparison is the trimmed value. The name written is the spelling in the change file.

`link.rewrite` (CORE-19) rewrites a string that matches the route pattern and leaves every other JSON value, including `null` and an absent key, unchanged. `field.deprecate` (CORE-20) does not change the body.

`object.wrap` on `up` moves each listed key that is present, including a key whose value is `null`, under `into`, and omits listed keys that are absent. On `down`, keys inside `into` move back to the parent. An absent `into` is a no-op. An `into` whose value is `null` is `AV-E016`.

A repeated key is `AV-E015` in a JSON object, in a query string, and in a form body (`application/x-www-form-urlencoded` or a text field of `multipart/form-data`). The last value does not win. The request fails before a handler sees it. This is the same rule in all three places (D-41). It replaces the earlier form rule that kept the last urlencoded value.

## B11. Atomic conversion

An op returns a new value. It does not mutate its input (CORE-11).

`AV-E004` on a walk, `AV-E014`, `AV-E015`, `AV-E016`, and `AV-E017` fail the whole conversion. The copy is discarded. The handler does not run. A response that fails on the way down is discarded too. `downgradeEvent` and queue conversion raise the same code and return no payload. `AV-E017` happens only on the way up.

- Failure on the way up: HTTP `400` and the error envelope (CORE-09, F3).
- Failure on the way down: HTTP `500` and the same envelope.
- `AV-E001`, `AV-E003`, `AV-E005`, `AV-E006`, and `AV-E013`, and a change-file path of 33 or more segments, refuse startup. They are not HTTP responses.

## B12. Header names

Header names compare case-insensitively. The name written on the way out is the spelling in the change file (`from` or `to`).

The version header (default `Api-Version`) follows CORE-02. Zero headers means the client did not send one, and resolution continues. One header, or several with the same trimmed value, selects that value. Two or more distinct trimmed values fail with `AV-E002`.

---

# PART C — FEATURES

Each feature has an ID. Part H assigns IDs to versions. Each feature lists **Done when** (tests that must pass) and **Refuses** (what it must not do).

## C1. Core model (CORE)

#### CORE-01 — Version bundle
Load `versions.yaml`, validate order, head, default policy and dates.
- Done when: valid bundle loads; unsorted, duplicate, future and malformed dates each fail with their code.
- Refuses: a head that is not the newest date.

#### CORE-02 — Version resolution
Find the client's version for a request.
- Order: explicit header (default name `Api-Version`, configurable) → resolver function given by the host (for example, look up the API key's pinned version) → the `default` policy.
- The header is matched case-insensitively (B12). Several headers with the same trimmed value count as one. Two distinct trimmed values return `400` with `AV-E002`.
- `pin-on-first-call` needs a pin store (LIFE-05). Without one, startup fails with `AV-E005`.
- Query parameter (`?api_version=`) is off by default and opt-in.
- Done when: each source wins in the order above; an unknown date returns `400` with the list of supported dates (`AV-E002`); a date older than the oldest supported returns `410` with a `Sunset` link (`AV-E012`); two distinct version headers return `AV-E002`.
- Refuses: treating header names as case-sensitive, or picking the first of two disagreeing version headers.

#### CORE-03 — Change-file loader
Load every `*.yaml` change file, validate it against the JSON Schema, attach it to its version, and link `custom` converters by name.
- Done when: a missing converter, unknown op, unknown schema name, a change dated on no listed version, or two files with the same `version` and `id` each fail at startup, not at request time.

#### CORE-04 — Conversion chains
For a request at version V, run `up` as in B9. For the response, run `down`, which is that op sequence reversed.
- Done when: a 3-version fixture converts in B9 order both ways; two change files that share a date run in ascending `id` on the way up and in reverse on the way down; two ops in one file do the same; head requests run zero conversions.
- Refuses: calling the handler after `AV-E014`, `AV-E015`, or `AV-E016`, or sending a partly converted body.

#### CORE-05 — Declarative operations
Implement every op in B4, including the absence and `null` rules in B10.
- Done when: each op has a positive test, a no-op test (field absent), a `null` test, and a round-trip test where B10 says the op is reversible.
- Refuses: replacing a present `null` with `default` on `field.add` up.

#### CORE-06 — Paths
Implement B5 paths, `[]`, `*`, and the depth cap.
- Done when: nested arrays of objects convert; `*` walks keys in current order; a change-file path of 33 segments fails at startup; a value walk that reaches a 33rd segment fails the conversion with `AV-E004`.
- Refuses: building a regular expression from a path.

#### CORE-07 — Schema binding
Apply a change wherever the schema graph names that schema (B6).
- Done when: one change on `Hotel` converts `GET /hotels/:id`, `GET /hotels` (array), and `GET /bookings/:id` (`booking.hotel`) with no per-route code; a paginated schema converts `data[]` through its item schema and leaves `next_cursor` alone; an unregistered object with the same shape is not converted.
- Refuses: reading field order with reflection on the request path.

#### CORE-08 — Error bodies
`error.shape` changes apply to error responses. An error response with no matching change runs no op. If the plan is empty it is not re-encoded (PERF-01). If some other op on that response did run, the bytes are canonical (B7).

#### CORE-09 — Error envelope
Every client-visible code in F3 returns HTTP status from that table and a JSON body `{ error: { code, message, supportedVersions } }`. `message` is the template in F3. `supportedVersions` is the bundle's dates, newest first. Node and Spring use the same bytes for the same failure.

#### CORE-10 — Released versions are frozen
`apiversa lock` writes `api-versions/.lock.json` with the SHA-256 of every change file of every released version. Startup in production fails if a locked file changed (`AV-E006`).
- Why: editing an old change file silently changes what old clients receive.
- Node production startup reads the lock (node 0.2.0). Spring reads it when the active profile is `prod` or `production`, and fails with `AV-E006` when a locked file changed (spring 0.16.0).

#### CORE-11 — Purity check
In development mode, inputs to converters are deep-frozen. A converter that mutates its input throws `AV-E007` naming the change. The request fails with HTTP `500` and the error envelope.

#### CORE-12 — Limits
- Max body converted: 1 MiB by default (`maxBodyBytes`). Above it: `oversize: 'error'` (default, `413` with `AV-E008` on the way up, `500` with `AV-E008` on the way down) or `'passthrough'` (opt-in). Passthrough sends the head shape on the way up only, and logs a warning. On the way down, oversize is always `AV-E008`. The head shape is never sent to an older client: that client would accept a body it does not understand (D-43). The head shape is not sent for `AV-E014` or `AV-E015`.
- Keys `__proto__`, `constructor`, `prototype` are dropped from every object in a converted body before ops run.
- Max array items converted per response: 10,000 (`maxArrayItems`); above it → `413` with `AV-E009`.
- Duplicate keys are `AV-E015`. Integers outside ±(2^53−1), and non-finite numbers, are `AV-E014`.
- Done when: a body of `maxBodyBytes + 1` returns `AV-E008`; an array of 10,001 items returns `AV-E009`; a duplicate key returns `AV-E015`; `9007199254740992` returns `AV-E014`; `__proto__` is absent from the output.
- Refuses: keeping the last duplicate key, or emitting a number outside the safe integer range as a JSON number.

#### CORE-13 — Query parameters
The `query.rename`, `query.add`, and `query.remove` ops (B4) upgrade old query parameters before the handler sees them. Absence follows B10.
- Done when: `GET /hotels?town=x` from a version before a `town` → `city` rename reaches the handler as `city=x`; a missing `query.add` parameter becomes `default`; `?guestCount=` stays empty; head requests are untouched; a repeated query key is `AV-E015` (B10).

#### CORE-14 — Form bodies
`application/x-www-form-urlencoded` and the text fields of `multipart/form-data` convert with the same field ops as JSON. File parts pass through untouched. A repeated form key is `AV-E015` (B10).
- Done when: a renamed form field upgrades; a file part is byte-identical after conversion; a repeated form key returns `AV-E015`.
- Refuses: buffering file parts in memory to convert them, and keeping the last repeated form key.
- Node does this on node 0.7.0. Spring MVC runs form bodies through `FormBodies` before the form converter (spring 0.16.0). A repeated form key is `AV-E015` (D-55).

#### CORE-15 — Validation errors in the client's terms
When the head schema rejects an upgraded request, the error paths are translated back to the client's version using the reverse of the rename and move ops. A client on an old version that sent `town` sees an error about `town`, not `city`.
- Done when: a rename, a move, and a nested array path each map back correctly; an error on a field that does not exist in the old version is reported under `_head` with the head path.
- Refuses: returning a head-only path as if the client had sent that field.

#### CORE-16 — Response version header
The response writes the resolved date on the version header (the configured name, default `Api-Version`). The spelling is the name from options, not the case the client sent.
- Written on a successful response, and on any HTTP error where a bundle date was chosen, including `AV-E010`, `AV-E011`, and `AV-E012`.
- Omitted when no date was chosen (`AV-E002`).
- An empty body plan still does not parse the body (PERF-01). Setting this header is not a body parse.
- Done when: an explicit date is echoed; the default-policy date is echoed; the head date is echoed; an `AV-E002` response has no version header; a head request does not parse the body.
- Refuses: writing a date that is not in the bundle, or changing the header value the client sent on the request.

#### CORE-17 — Unpinned-client header
When the date came from the `default` policy, the response includes `Apiversa-Default` set to that date. When the client sent the version header, or the resolver returned a date, the header is absent. The status code is unchanged. RFC 9111 obsoletes `Warning`, so this is not a `Warning` header.
- Done when: a request with no version header and no resolver result sets `Apiversa-Default` to the default-policy date; an explicit header does not, even when that date equals the default; a resolver pin does not.
- Refuses: setting `Apiversa-Default` when the client sent a version header.

#### CORE-18 — Header add and remove
`header.add` and `header.remove` follow B4 and B10. Names compare case-insensitively (B12). `default` is a string. The target name must not be the configured version header.
- Done when: an absent request header becomes `default` on the way up; an empty request header stays empty; a response header whose trimmed value equals `default` is removed on the way down for `header.add`; `header.remove` drops a present request header on the way up and sets `default` on the response when the header is absent; one conformance fixture covers each op.
- Refuses: adding or removing the configured version header, a non-string `default`, or treating header names as case-sensitive. Those files fail startup with `AV-E001`.

#### CORE-19 — Link rewrite
`link.rewrite` rewrites one string field that holds a path. `path` is a B5 field path. `from` and `to` are route paths using `:param` segments, the same spelling as `endpoint.rename`. A `{param}` spelling fails startup with `AV-E001`.
- The value's path is split on `/` and matched segment by segment. A `:param` segment captures one non-empty segment. Literals match exactly. Captures are substituted into the destination by parameter name. The query string and the fragment are copied. An absolute URL keeps its scheme, host, and port; only the path is rewritten. No percent-decoding.
- A non-matching string, a non-string (including `null`), and an absent key are unchanged.
- Done when: `/hotels/h_1` with `from: /hotels/:id` and `to: /properties/:id` becomes `/properties/h_1` on the way up and the reverse on the way down; `https://api.example/hotels/h_1?x=1` keeps the host and the query; `/other/h_1` and `null` stay as they are; one conformance fixture covers a match and a non-match.
- Refuses: building a regular expression from `from` or `to`, rewriting the host, or fetching the URL.

#### CORE-20 — Field deprecation marker
`field.deprecate` names a field that is still present. Neither direction changes the body. The body plan treats the op as skipped (B9). Per-version OpenAPI marks that property `deprecated: true` on versions at or after the change, and not on older versions. The changelog line is the change file's `description`.
- Done when: the canonical body is unchanged in both directions; the head OpenAPI property is `deprecated: true`; an older document from before the change is not; the changelog includes the description; one conformance fixture expects the input bytes as the output.
- Refuses: removing the field or changing its value.

#### CORE-21 — Discriminator binding
A schema may store one discriminator: a B5 path and a map from strings to schema names. Zod reads it from `z.discriminatedUnion` when the discriminator key is a string literal. Spring stores it with `ApiversaSchemas.discriminator(schema, path, mapping)`. The parent schema's field list still orders keys (B7).
- A change whose schema is a mapped variant runs on a value of the parent schema only when the string at the discriminator path equals that mapping key. A change whose schema is the parent always runs. Unknown, non-string, `null`, and absent discriminator values run the parent changes and skip every variant. That is not an error.
- Done when: a `card` object gets a `Card` rename and does not get a `BankAccount` rename; a `bank_account` object does the opposite; an unknown `type` gets only the parent changes; an unregistered object is not converted.
- Refuses: running every variant's ops on one object, or failing the request because the discriminator value is unknown.

#### CORE-22 — Method change
`endpoint.method` routes an old method to the head method on the same path, for example `POST /search` to `GET /search`. Body-to-query moves are separate `param.move` ops in the same file.
- Rewriting happens before routing. Express and Koa rewrite `req.method` and `req.url` in middleware ahead of the router. Fastify registers the older method and path as a shim route through `av.route`, which converts and calls the head handler directly, with no second dispatch. Spring uses a servlet `Filter` (WebFlux: `WebFilter`) ahead of dispatch. Hono and Next rewrite the `Request`.
- Done when: an older `POST /search` reaches the `GET /search` handler; a head `POST /search` gets the framework's normal 404 or 405; the shared adapter suite passes on every adapter that has shipped.
- Refuses: running two handlers, or changing the method on head requests.

#### CORE-23 — Parameter relocation
`param.move` moves one value on the way up. `from` and `to` are each `path:<name>`, `query:<name>`, `header:<name>`, or `body:<B5 path>`.
- Path, query, and header values are strings and move as strings. No type coercion. A body value moving to path, query, or header must be a string, a number (canonical decimal, B7), or a boolean. An array of scalars becomes repeated query parameters, in order. Anything else is `AV-E016`. A path target needs a matching `:name` segment in the head route and is percent-encoded when written.
- An absent `from` is a no-op. If the target is already present with a different value, the request fails with `AV-E017`. An equal value is fine.
- Done when: `GET /hotels/:hotelId/rooms` → `GET /rooms?hotelId=` works; a body field moves to a query parameter; a body field moves to a header; a conflict returns `AV-E017`.
- Refuses: moving in the down direction, merging two sources into one target, or building a regular expression from a pattern.

#### CORE-24 — Op scope
Any field, enum, or object op may set `scope: { routes: ["GET /hotels/:id", ...], on: request | response }`. Without `scope`, the op runs everywhere the schema appears (B6). This narrows B6 for the ops that set it. `custom` remains the way to handle a route the team does not want in the shared plan.
- Scope is applied when plans compile (PERF-02) and costs nothing per request. Events count as `response` for `downgradeEvent` and as `request` for `upgradeEvent`. They never match a `routes` filter.
- Done when: a rename scoped to `on: response` does not run on a `POST` body of the same schema; a `routes` filter limits the op to listed routes; an unknown route pattern fails startup with `AV-E001`.
- Refuses: wildcard route patterns.

#### CORE-25 — Response envelope
`response.envelope` serves older clients a bare array when head returns a page `{ data: [...], next_cursor }`. On the way down, the body becomes the value at `items` (default `data`). With `cursorHeader` set, the cursor is written to that response header. Otherwise it is dropped.
- Older clients get the first page only. This is lossy, and docs must say so.
- Done when: an older client gets `[...]`; head gets the page; `cursorHeader` carries the cursor; a non-array `items` value is `AV-E016`.
- Refuses: following cursors to fetch further pages.

#### CORE-26 — Value prefix
`value.prefix` handles ID format migrations such as `123` → `"h_123"`. `target` is `body:<B5 path>`, `path:<name>`, or `query:<name>`. Path and query targets apply on the way up only. Body targets apply on the way up for requests and on the way down for responses.
- Up adds `prefix` to a string, or to a number's canonical decimal form. Down strips `prefix` when the string starts with it. With `numeric: true`, a digit-only remainder within ±(2^53−1) is emitted as a number. Non-matching strings, `null`, and absent keys are unchanged.
- Done when: a path param `/hotels/123` reaches the handler as `h_123`; a response `"h_123"` downgrades to `123` with `numeric: true`; `"x_9"` is unchanged.
- Refuses: regular expressions, suffixes, or any other string transform. Use `custom` for those.

#### CORE-27 — Endpoint deprecation
`endpoint.deprecate` marks one route. Every version where the route exists sends `Deprecation` (RFC 9745). With `sunset`, it also sends `Sunset` (RFC 8594) and a `Link` to `docs` when that is set. Per-version OpenAPI marks the operation `deprecated: true` in documents at or after the change. The changelog line is the description. The body is never touched.
- Done when: the headers are present on an old version and on head; OpenAPI before the change is not marked; one SHR-04 case covers it.
- Refuses: rejecting the request. Rejection is `endpoint.remove`.

## C2. Types (TYPE)

#### TYPE-01 — Head schemas
Zod 4 first. TypeBox and plain JSON Schema come with TYPE-05. The schema registry maps each name (`Hotel`) to an ordered field list and to nested schema names (B6). Zod object key order is that list.

#### TYPE-02 — Generated per-version schemas
`apiversa generate` writes `api-versions/generated/<date>.ts` with a Zod schema and a TypeScript type per schema per version (`Hotel_2026_01_15`).

#### TYPE-03 — Typed converters
A `custom` converter is typed by version: `(body: Hotel_2026_03_01) => Hotel_2026_01_15`. `tsc` fails when a converter returns the wrong shape.
- Done when: a converter whose return type still has a head-only field fails `tsc`.

#### TYPE-04 — Round-trip property tests
For each request schema, generated samples pass `down(up(x))` equal to `x` where B10 says the ops are reversible. Equality is canonical bytes (B7). Uses `fast-check` (dev dependency only).

#### TYPE-05 — TypeBox and JSON Schema
Schema registries for TypeBox and plain JSON Schema (draft 2020-12), with the same generator output as Zod (TYPE-02).
- Done when: the Zod example app, rewritten with TypeBox and with JSON Schema, produces identical per-version OpenAPI and conversions.

## C3. Framework adapters (FW)

Every adapter must pass the shared adapter test suite (same fixtures for all frameworks), add no conversion work on head requests, and still apply `error.shape` when a handler throws. No adapter patches its framework globally: only routes registered through apiversa are converted (ADOPT-02).

#### FW-01 — Express adapter
`@apiversa/express` for Express 4 and 5. Middleware before the router; wraps `res.json` and `res.send` for JSON bodies.
- Done when: the shared adapter suite passes on Express 4 and 5.

#### FW-02 — Fastify adapter
`@apiversa/fastify` for Fastify 5. `preValidation` hook for `up`. `onSend` for `down`, after Fastify 5 has validated and serialized the head response (D-20).
- Done when: the shared adapter suite passes; Fastify response schemas validate the head shape before the `onSend` downgrade.

#### FW-03 — NestJS adapter
`@apiversa/nest` for NestJS 10 and 11. A module plus an interceptor. Works next to Nest's built-in URI versioning.
- Done when: the shared adapter suite passes on Nest 10 and Nest 11, each with the Express and Fastify platforms. Nest 10 is `node/nest10-check/fw03.test.ts`. Nest 11 is `node/packages/nest/test/nest.test.ts`.

#### FW-04 — Hono adapter
`@apiversa/hono` for Hono 4, on Web `Request`/`Response`. Runs on Node, Bun, Deno and Cloudflare Workers.
- Done when: the shared adapter suite passes on Node and on Workers through Miniflare.

#### FW-05 — Next.js adapter
`@apiversa/next`: a wrapper for App Router route handlers.
- Done when: the shared adapter suite passes against route handlers.

#### FW-06 — Koa adapter
`@apiversa/koa` for Koa 2 and 3.
- Done when: the shared adapter suite passes.

## C4. Documentation output (DOC)

#### DOC-01 — OpenAPI per version
From the head OpenAPI 3.1 document plus the change files, produce one OpenAPI document per version. Added endpoints disappear from older documents, removed ones reappear, schemas match the generated per-version schemas.

#### DOC-02 — Version picker
Config output for Scalar and Swagger UI to show all versions in one page with a picker.

#### DOC-03 — API changelog
`apiversa changelog` writes Markdown and JSON: per version, the `description` of each change and the endpoints it touches. This is the Stripe-style "what changed" page.

#### DOC-04 — Upgrade guide per client
`apiversa upgrade-guide --from 2025-10-01` lists every change between that version and head, grouped by endpoint.

#### DOC-05 — Type diff per version
`apiversa changelog --types` adds, for each version, the TypeScript declaration diff of every changed schema, so SDK users see exactly what moved.

#### DOC-06 — Webhooks in per-version OpenAPI
The head OpenAPI 3.1 document may contain a `webhooks` map. Each per-version document rewinds those payload schemas with the same rules as response schemas (DOC-01). Spring writes that same `webhooks` object into the per-version document.
- Done when: a `field.rename` on a webhook schema shows the older property name in the older document; a `field.add` omits that property from older documents; a `field.deprecate` (CORE-20) marks the property deprecated only from that version forward; a head document with no `webhooks` key produces none.
- Refuses: leaving the head property names in an older webhook schema.

#### DOC-07 — Upgrade matrix
`apiversa matrix` writes `upgrade-matrix.json`. `mvn apiversa:matrix` writes the same bytes. The file has `head` and a `versions` object. Each older date maps to the change ids between that date and head, in B9 `up` order, with each change file's `description`. Head maps to an empty list. `--out` chooses the path. The default path is `upgrade-matrix.json` in the working directory.
- Done when: the order matches B9 for a two-change bundle; descriptions match the change files; head is `[]`.
- Refuses: calling the network, or inventing a description that is not in a change file.

## C5. Webhooks and events (EVT)

#### EVT-01 — Downgrade an outgoing event
`downgradeEvent(payload, 'Booking', '2025-10-01')` returns the payload in that version's shape using the same change files.

#### EVT-02 — Subscriber pins
Each webhook subscriber can have its own pinned version through the resolver or pin store.

#### EVT-03 — Message queues
Same conversion for Kafka, SQS or RabbitMQ message bodies, keyed by a version header on the message. Spring Kafka first (SPR-07).

#### EVT-04 — Upgrade an incoming event
`upgradeEvent(payload, schema, version)` runs the `up` chain from that version to head, the same chain as `convertRequest`. `downgradeEvent` stays the `down` chain (EVT-01). An unknown date is `AV-E002`. An empty plan returns the original payload and does not parse it (PERF-01). A conversion failure uses the `up` codes in B11 and returns no payload. Node: `av.upgradeEvent`. Spring: `Engine.upgradeEvent`.
- Done when: an older body becomes the head shape; the head version with an empty plan returns the same bytes; an unknown date is `AV-E002`; a failure returns no payload.
- Refuses: calling the network, or running the `down` chain when asked to upgrade.

## C6. Streaming (STR)

#### STR-01 — Lists and pagination
Arrays and paginated envelopes (`{ data: [...], next_cursor }`) convert item by item.

#### STR-02 — NDJSON and SSE
Streaming responses convert per line or per event without buffering the whole stream.

## C7. Testing and CI (TEST)

#### TEST-01 — Breaking-change gate
`apiversa check` compares the current head schemas with the snapshot from the last release (`api-versions/snapshots/<date>.json`). A difference with no change file for a new version fails with exit code 1 and lists every difference.
- This is the feature that runs in every pull request.

#### TEST-02 — Contract fixtures
Record request/response pairs at head. `apiversa test` replays them through every supported version and compares with the stored per-version snapshot.

#### TEST-03 — Change coverage
Report every change that no fixture exercises. CI fails when coverage of changes is under 100 %.

#### TEST-04 — Pull-request summary
`apiversa check --format markdown` prints which versions and endpoints a change affects. Posting it is a CI step, not the library.

#### TEST-05 — Test helpers
`request(app).version('2026-01-15')` for Supertest; a Vitest matcher `toMatchVersion(date, schema)`.

#### TEST-06 — Draft suggestion
When `apiversa check` finds a rename, an added field or a removed field, `--suggest` writes a **draft** change file marked `draft: true`. Startup refuses drafts (`AV-E013`) until the flag is removed.

#### TEST-07 — Traffic replay
`apiversa replay samples.jsonl` takes recorded `(version, request, response)` samples that the host exported from its own logs, runs each through the current head plus chains, and reports every response that differs from what that client received before. This proves a new change file does not alter old versions on real traffic.
- Refuses: capturing traffic itself, or sending samples anywhere. The host supplies the file.

#### TEST-08 — Fuzz suite
Seeded fuzzing of the YAML parser, the path parser, and every op: 100,000 inputs each per run. No crash, no prototype pollution, no input that takes more than 10 ms to convert at 10 KB.
- Done when: the suite runs in CI with a fixed seed and in the HARDEN run with a new seed recorded in the result file.

## C8. Lifecycle (LIFE)

#### LIFE-01 — Deprecation and Sunset headers
Versions marked `deprecated` send `Deprecation` (RFC 9745) and, when `sunset` is set, `Sunset` (RFC 8594) plus a `Link` to the upgrade guide.

#### LIFE-02 — Usage counters
Count requests per version, conversions per change, and per client when the resolver returns a client id. In memory, with an export hook. Adapters: Prometheus text format, OpenTelemetry metrics.
- Refuses: sending data anywhere by itself. No telemetry.

#### LIFE-03 — Safe-to-remove report
From the counters: versions with zero requests in N days, and changes used only by those versions.

#### LIFE-04 — Retire a version
`apiversa retire 2025-10-01` removes that version and any change files only it needed, and marks it `410`. Refuses while the counters show traffic in the last 30 days, unless `--force`.

#### LIFE-05 — Pin stores
Interface `{ get(clientId), set(clientId, date) }`. Memory (core) and Redis (`@apiversa/pin-redis`). Postgres is LIFE-07.

#### LIFE-06 — Pin upgrade with preview
`av.previewUpgrade(clientId, toDate)` returns, per endpoint the client used (from LIFE-02 counters), the list of changes between its pin and `toDate` with a before/after sample. `av.upgradePin(clientId, toDate, { dryRun })` moves the pin. This is the "upgrade your API version" button Stripe gives its users, as a library call the host can put behind its own dashboard.
- Refuses: moving a pin backwards without `{ allowDowngrade: true }`.

#### LIFE-07 — Postgres pin store
`@apiversa/pin-postgres`, using the host's `pg` pool (peer dependency). One table, created by a migration the host runs.

#### LIFE-08 — Sunset enforcement
A version entry may set `sunsetEnforce: true` beside `sunset`. The default is false, which keeps LIFE-01: the `Sunset` header is sent and the handler runs. `schema/change-file.schema.json` accepts `sunsetEnforce`.
When `sunsetEnforce` is true and `sunset` is strictly before the UTC date, a request for that version returns `410` with `AV-E012` and the Sunset link from CORE-02. The date stays in `supportedVersions`. A sunset of today or later does not reject. The engine option `now` is a `YYYY-MM-DD` string. Tests set it. When it is omitted, the engine uses the UTC calendar date at the start of that request.
- Done when: `sunsetEnforce: true` and a past sunset return `AV-E012`; the same sunset without the flag runs the handler and still sets `Sunset`; `sunsetEnforce: true` and a future sunset run the handler; a test passes `now` and does not read the clock.
- Refuses: rejecting a version that has `sunset` and does not have `sunsetEnforce: true`.

## C9. Adoption (ADOPT)

#### ADOPT-01 — Existing `/v1`, `/v2`
`legacyPrefixes: { '/v1': '2025-10-01', '/v2': '2026-01-15' }` maps old URL versions to dates, so a team can switch without breaking URLs.

#### ADOPT-02 — Per-route opt-in
Only routes registered with apiversa are converted. The rest of the app is untouched.

#### ADOPT-03 — Eject
`apiversa eject` writes every change as plain functions plus explicit routing code, so a team can leave without rewriting. A clear way out is what gets teams to adopt core infrastructure.

#### ADOPT-04 — Init
`npx apiversa init` creates `api-versions/`, `versions.yaml`, and one commented example change file.

## C10. Debugging (DBG)

#### DBG-01 — Trace header
In development, `Apiversa-Trace: 2026-03-01.price-object, 2026-01-15.rename-city` lists applied changes. Off in production unless `trace: true`.

#### DBG-02 — Explain
`apiversa explain --version 2025-10-01 --route "GET /hotels/:id"` prints the chain and a before/after sample.

#### DBG-03 — Logging hook
`onConvert({ change, direction, ms })` for the host's logger.

#### DBG-04 — Doctor
`apiversa doctor` checks the bundle, change files, locks, drafts, missing converters, schemas no route uses, routes with no declared schema, and pin-store wiring. It prints each problem with its fix and exits non-zero on any error.

#### DBG-05 — Step diff
`apiversa diff --schema Hotel --from 2025-10-01 --to 2026-03-01 --body body.json` prints the chain between those dates. `mvn apiversa:diff` takes the same `schema`, `from`, `to`, and `body` values. `--to` defaults to head. When `from` is older than `to`, the direction is `up`. When `from` is newer, the direction is `down`. Equal dates print no steps.
Each step is one line: `<version>.<id>` and the canonical body after that op, in B9 order for the chosen direction. Exit 0 on success. Exit 1 prints the `AV-E` code on stderr and no body. `--out` writes the final canonical bytes. Without `--out`, no file is written.
- Done when: two changes print two steps in B9 order; equal dates print no steps; a bad body exits 1 with the code; `--out` is the only path that writes a file.
- Refuses: calling the network, or writing a file when `--out` is absent.

## C11. Performance (PERF)

#### PERF-01 — Head fast path
A head-version request reads one header and returns. No body parse, no allocation beyond that. Any route and version whose plan contains zero ops takes the same path (B7). Duplicate keys and pollution keys are checked only on bodies that plan parses.
- Done when: a head request, and a request whose selected change list is empty, do not parse the body. Writing the response version header (CORE-16) or `Apiversa-Default` (CORE-17) is not a body parse.

#### PERF-02 — Precompiled plans
At startup, each (route, version) pair compiles to an immutable list of operations in B9 order. No path parsing at request time. Requests only read the list.
- Done when: two overlapping requests on the same plan both match the single-request result.

#### PERF-03 — Benchmark script
`bench/run.mjs` measures the budgets in F1 and writes `bench/results/<date>.json`. `docs/BENCHMARKS.md` copies numbers only from those files.

## C12. Spring (SPR)

#### SPR-01 — Platform
Java 17+, Spring Boot 3.3+ and 4.x, Spring MVC. Auto-configuration module `apiversa-spring-boot-starter`.

#### SPR-02 — Same change files
Reads the same `api-versions/` folder and validates against the same JSON Schema. Java `custom` converters are classes annotated `@VersionChange("2026-03-01.price-object")`.

#### SPR-03 — Version resolution
On Spring Framework 7, plugs into `ApiVersionResolver` so Spring's own routing and apiversa agree on the version. `apiversa-spring-framework7` compiles against Spring Framework 7.0.10 and delegates to `Engine.resolve`. On Boot 3, the starter uses its own resolver with the same order as CORE-02.

#### SPR-04 — Conversion
Request upgrade in `RequestBodyAdvice`, response downgrade in `ResponseBodyAdvice`, both on a Jackson `JsonNode` tree. Schema binding uses the stored field list (B6). The advice does not reflect and does not use Jackson's alphabetic property order. Numbers and key order match B7, including integers that Java would otherwise write with a fraction.

#### SPR-05 — OpenAPI per version
springdoc-openapi integration: one group per version.

#### SPR-06 — WebFlux
Same features on Spring WebFlux.

#### SPR-07 — Kafka messages
EVT-03 for Spring Kafka: convert message values by a version header.

#### SPR-08 — Micrometer
LIFE-02 counters as Micrometer meters.

#### SPR-09 — Test support
JUnit 5 extension and `MockMvc` helper `.apiVersion("2026-01-15")`, plus the shared conformance suite.

#### SPR-10 — Bean Validation errors
CORE-15 for Spring: Jakarta Bean Validation errors on an upgraded request are reported with the client's field names.

#### SPR-11 — GraalVM native image
Runtime hints so the starter works in a Spring Boot native image.
- Done when: the example app builds and passes its tests as a native image in CI. Reflection is registered and the JVM test passed. The image was not built (D-31). The ID moves to spring 0.17.0 and stays unchecked (D-56).

#### SPR-12 — Kotlin
Kotlin extension functions and a small DSL for `custom` converters, with null-safety annotations on the Java API.

#### SPR-13 — Actuator endpoint
`/actuator/apiversa`: supported versions, deprecations, usage counts per version, and the safe-to-remove report (LIFE-03). Read-only.

#### SPR-14 — Maven plugin
`apiversa-maven-plugin` with goals `check` (TEST-01), `changelog` (DOC-03) and `lock` (CORE-10), so Java teams get the same CI gate without Node.
- Done when: `check` fails when the head schema changed and no change file covers the diff, and production startup reads the lock file. `check` diffs `head.json` against the newest file in `snapshots/`. A draft change file does not cover the diff. Production startup is CORE-10.

## C13. Shared between Node and Spring (SHR)

#### SHR-01 — Change-file JSON Schema
`schema/change-file.schema.json`, versioned. Both libraries validate with it.

#### SHR-02 — Conformance suite
`conformance/fixtures/**` holds language-neutral cases. Each case folder has `versions.yaml`, `changes/*.yaml`, and `case.json`.

`case.json` contains `schema`, `direction` (`up` or `down`), and `version`. The body is `input` (a JSON value) or `raw` (the exact bytes the library parses, required when the case cares about duplicate keys or number spelling). Success cases set `expected`. Failure cases set `error` to an `AV-E` code and omit `expected`. Optional `fields` is the registry order for `schema`. Optional `schemas` maps nested schema names to field arrays. When `fields` is omitted, objects keep input key order (B6).

Node and Spring both run every case. A success case compares the canonical bytes of `expected` with the canonical bytes of the result (B7). A failure case compares the error code.
- Done when: `field-type-price`, `field-add-null`, `field-add-absent`, `field-order`, `same-date-order`, and `canonical-integer` match; `duplicate-key` returns `AV-E015`; `unsafe-integer` returns `AV-E014`.

#### SHR-03 — Cross-implementation gate
A release of either library is blocked while any conformance case fails in the other library at its latest released version.

#### SHR-04 — Request-level conformance cases
A case may set `request: { method, path, query, headers, body }` instead of `input`, and `expected: { method, path, query, headers, body }` (up) or `response: { status, headers, body }` (down). `query` is an ordered list of `[name, value]` pairs. Header names compare per B12. Body bytes compare per B7. A body-only case (SHR-02) stays valid.
- Done when: every existing route-level op (`endpoint.*`, `status.change`, `header.*`, `query.*`, `link.rewrite`) has at least one case; Node and Spring both run them.
- Refuses: an adapter-specific case. Cases describe the request, not the framework.

## C14. Client (CLIENT)

#### CLIENT-01 — Typed client
`@apiversa/client`: a small `fetch` wrapper for browsers, React Native and Node that sends the pinned version header and returns types generated for that version. No React dependency.

#### CLIENT-02 — React hook
`@apiversa/react`: `useApiVersion()` and a provider. Thin layer over CLIENT-01.

## C15. Observability (OBS)

#### OBS-01 — Tracing
`@apiversa/otel`: one OpenTelemetry span per conversion chain with attributes `apiversa.version`, `apiversa.changes`, `apiversa.direction`, and duration. No span on head requests.

#### OBS-02 — Unpinned counter
LIFE-02's snapshot gains `unpinned`, a count per version of requests whose date came from the `default` policy. An explicit version header does not increment it. A resolver pin does not increment it. Prometheus text adds `apiversa_unpinned_total{version="..."}`. Spring adds a Micrometer meter `apiversa.unpinned` tagged with `version`, and the actuator report includes the same counts. The library still does not send them.
- Done when: a default-policy request increments `unpinned` for that date; an explicit header does not; a resolver pin does not; `stats()` and the actuator report show the count.
- Refuses: opening a socket, or counting a request that sent the version header.

---

# PART D — NODE LIBRARY

## D1. Packages

| Package | Contents |
| --- | --- |
| `apiversa` | Core engine, YAML loader, CLI |
| `@apiversa/express` | Express adapter |
| `@apiversa/fastify` | Fastify adapter |
| `@apiversa/nest` | NestJS adapter |
| `@apiversa/hono` | Hono adapter |
| `@apiversa/next` | Next.js adapter |
| `@apiversa/koa` | Koa adapter |
| `@apiversa/zod` | Zod schema registry and generator |
| `@apiversa/json-schema` | JSON Schema registry. TypeBox schemas enter through `defineTypeBoxSchemas` (TYPE-05) |
| `@apiversa/pin-redis` | Redis pin store |
| `@apiversa/pin-postgres` | Postgres pin store |
| `@apiversa/otel` | OpenTelemetry spans |
| `@apiversa/client` | Client side |
| `@apiversa/react` | React client |

Core has zero runtime dependencies. The YAML parser is a small, vendored, safe subset (no anchors, no tags, no custom types) inside core.

## D2. Public API (core)

```ts
import { createApiversa } from 'apiversa';

const av = createApiversa({
  dir: './api-versions',
  schemas: { Hotel, Booking },          // from @apiversa/zod
  header: 'Api-Version',
  resolve: (req) => pins.get(req.apiKeyId),
  converters: { 'price-object': priceObject },
});

av.convertRequest({ schema: 'Hotel', body, version });
av.convertResponse({ schema: 'Hotel', body, version });
av.downgradeEvent(payload, 'Booking', '2025-10-01');
av.stats();
```

`schemas` is the registry in B6. Zod key order is the field list. `convertRequest` runs `up`. `convertResponse` and `downgradeEvent` run `down`. An empty plan returns the original body without parsing it.

## D3. Route declaration (Express example)

```ts
import { apiversa } from '@apiversa/express';

app.use(apiversa(av));
app.get('/hotels/:id', av.route({ response: 'Hotel' }), getHotel);
app.post('/bookings', av.route({ body: 'BookingInput', response: 'Booking' }), createBooking);
```

## D4. CLI

`apiversa init | lock | doctor | generate | check | test | openapi | changelog | eject | explain | retire | replay | diff | matrix | upgrade-guide`

---

# PART E — SPRING LIBRARY

## E1. Modules

| Module | Contents |
| --- | --- |
| `apiversa-core-java` | YAML loader, ops, chains (no Spring) |
| `apiversa-spring-boot-starter` | Auto-configuration, MVC advice, resolver |
| `apiversa-spring-framework7` | Framework 7 `ApiVersionResolver` |
| `apiversa-webflux` | WebFlux |
| `apiversa-springdoc` | OpenAPI groups per version |
| `apiversa-kafka` | Message conversion |
| `apiversa-micrometer` | Counters |
| `apiversa-actuator` | Actuator endpoint |
| `apiversa-kotlin` | Kotlin extensions |
| `apiversa-maven-plugin` | Maven goals |
| `apiversa-test` | JUnit 5 and MockMvc helpers |

## E2. Configuration

```yaml
apiversa:
  dir: classpath:api-versions
  header: Api-Version
  default: oldest
```

## E3. Route declaration

```java
@GetMapping("/hotels/{id}")
@ApiversaResponse("Hotel")
public HotelDto get(@PathVariable String id) { ... }
```

Register each schema with an ordered field list before the first request. `@JsonPropertyOrder` supplies that list when it is present. Jackson's default property order is not the registry order.

---

# PART F — QUALITY

## F1. Performance budgets (targets, not measurements)

| Case                                              | Budget (p50) |
| ------------------------------------------------- | ------------ |
| Head-version request overhead                     | < 5 µs       |
| One change, 10 KB JSON response downgrade         | < 50 µs      |
| Ten changes, 10 KB JSON response downgrade        | < 300 µs     |
| Startup with 50 change files                      | < 200 ms     |
| Spring: one change, 10 KB JSON response downgrade | < 100 µs     |

A missed budget is recorded with its real number in `docs/BENCHMARKS.md`. The budget is never raised. A miss blocks the release of the version that owns that case until the case is under budget or a `docs/DECISIONS.md` line moves it.

## F2. Test gates

- Node: line coverage ≥ 90 %, branch ≥ 85 %. Mutation score (Stryker) ≥ 75 % on `src/ops/` and `src/chain/`.
- Spring: line coverage ≥ 85 % (JaCoCo). Mutation score (PIT) ≥ 70 % on ops and chains.
- Conformance: 100 % of cases pass in both libraries.
- Change coverage (TEST-03) in the example apps: 100 %.
- Performance: no F1 case may get more than 10 % slower than the previous stable release on the same machine. A regression above that blocks the release; the budget is never raised.

## F3. Error codes

`message` is exact. Both libraries use these sentences. An HTTP error uses the envelope in CORE-09. A startup error exits non-zero and does not serve traffic.

| Code      | Status | Message |
| --------- | ------ | ------- |
| `AV-E001` | startup | Change file failed validation. |
| `AV-E002` | 400 | Unknown version. |
| `AV-E003` | startup | Version date is in the future. |
| `AV-E004` | startup, or 400 on the way up, or 500 on the way down | Path is deeper than 32 segments. |
| `AV-E005` | startup | pin-on-first-call requires a pin store. |
| `AV-E006` | startup | A locked change file was modified. |
| `AV-E007` | 500 | Converter mutated its input. |
| `AV-E008` | 413 | Body is larger than the limit. |
| `AV-E009` | 413 | Array is larger than the limit. |
| `AV-E010` | 404 | Endpoint does not exist in this version. |
| `AV-E011` | 410 | Endpoint has been removed. |
| `AV-E012` | 410 | Version is older than the oldest supported version. |
| `AV-E013` | startup | A draft change file is present. |
| `AV-E014` | 400 on the way up, 500 on the way down | JSON number cannot be encoded. |
| `AV-E015` | 400 on the way up, 500 on the way down | Duplicate JSON key. |
| `AV-E016` | 400 on the way up, 500 on the way down | Expression could not be read. |
| `AV-E017` | 400 | Parameter target is already set. |

`supportedVersions` is present on every HTTP error and lists the bundle dates, newest first. `AV-E012` also sends the Sunset link required by CORE-02. `AV-E002` carries the supported dates in `supportedVersions`, not in `message`.

## F4. Security

- No `eval`, no `new Function`, no regular expressions from user files or from paths.
- Prototype-pollution keys are dropped before ops run (CORE-12).
- Duplicate keys are rejected (AV-E015). The last key does not win.
- Integers outside ±(2^53−1), and non-finite numbers, are rejected (AV-E014).
- A failed conversion does not call the handler and does not send a partial body (B11).
- YAML subset with no anchors, aliases, or tags (avoids billion-laughs and type confusion).
- No network calls from any package except the pin-store adapters the host configures.

---

# PART G — DELIBERATELY NOT INCLUDED

- GraphQL versioning. GraphQL evolves schemas differently.
- Automatic change files from a diff. Only drafts (TEST-06); a person or the agent reviews them.
- A proxy or gateway mode in core. Maybe a separate package after 1.0.
- A hosted dashboard. A possible paid product later, outside these packages.
- Telemetry or phone-home of any kind.
- AI inside the runtime.
- Rewriting business logic. apiversa converts data shapes; it does not run old handlers except `endpoint.remove` legacy handlers the team keeps.
- Endpoint split (one old call becomes N new calls). It would run handlers more than once and can fail partway, which breaks B11. Use `endpoint.remove` plus `legacyHandler`.
- Endpoint merge (N old calls become one batch call). It needs state across requests.
- Sync to async (an old `200` versus a new `202` plus polling). The downgrade would have to wait or poll. Use `legacyHandler`.
- Expanded versus ID-only nested objects (Stripe `expand`). The downgrade would load data from a database or the network, which breaks purity and the no-network rule. Revisit only with an external `issue:`.
- Offset to cursor pagination. Cursors are opaque to apiversa, so this needs a host hook. Use `custom` until someone asks.
- XML/JSON negotiation.

---

# PART H — ROADMAP (which features ship in which version)

## H0. Rules for this roadmap

1. The agent builds only the IDs listed under the version being built.
2. Every line has `Evidence:`. Allowed evidence for the first plan: `cadwyn` (Cadwyn has it: proven demand), `stripe` (Stripe documents it), `spring7-gap` (Spring 7 lacks it), `rfc`, `safety`, `adoption`. **A feature added after 2026-10-30 needs `Evidence:` of `issue:<url>` (an issue opened by someone other than the author), `eval:<file>`, or `bug:<test>`.**
3. At most 3 new IDs may be added to a version after its first pre-release.
4. A version is shipped only when every ID listed is done. Unfinished IDs move to the next version in the same commit, with a line in `docs/DECISIONS.md`.
5. Node and Spring ship separately, on their own weekly cadence. Both 0.1.0 releases are large starters. A direct request to build a version implements every ID for that version on both tracks, then merges and publishes both, as the agent rule at the top of this file says. The two libraries produce the same conversion output from the same change files.
6. `1.0.0` of either track is a major release. The agent prepares it and stops (see `docs/AUTOPILOT.md`).
7. Shipped versions are recorded in `docs/VERSION-HISTORY.md`. After a track's first release, the guard checks that every shipped feature is listed here for that version. The first release follows rule 9.
8. **Release bar.** A version ships only when every one of these holds. Missing any one means it does not ship that week:
   - every ID passes all of its **Done when** tests and **Refuses** negative tests;
   - user docs cover every ID (a section in `docs/CHANGE-FILES.md`, `docs/MIGRATION.md`, or a new page under `docs/guide/`), with a runnable snippet;
   - the example apps use every user-visible ID;
   - every op added or changed has at least one conformance case;
   - F2 gates are met: coverage, mutation score, fuzz suite (once TEST-08 ships), no performance regression over 10 %;
   - the tarball install test and, after publish, the stranger check pass;
   - no open hard stop and no red run on `next` in the last 24 hours.
9. **First release.** The first published version of each track contains every ID that passes at that commit. `docs/VERSION-HISTORY.md` lists all of them, not only that version's section. Later versions list only their own section.

## H1. Node track (23 versions)

Each version has one theme. Node 0.1.0 is the large starter release and is built together with spring 0.1.0 when the owner asks for 0.1.0. Later versions are focused so each can meet the H0 rule 8 bar quickly. In launch mode (first 28 days, up to one stable release a day when the bar is met) several small versions can ship in the first month; after that, one a week. The release bar decides the pace, not the calendar. `[x]` after an ID means that ID is implemented and its tests passed. It does not mean the package is published.

### node 0.1.0
Theme: usable core on Express and Fastify.
- **CORE-01** [x] Version bundle — Evidence: cadwyn
- **CORE-02** [x] Version resolution — Evidence: stripe
- **CORE-03** [x] Change-file loader — Evidence: cadwyn
- **CORE-04** [x] Conversion chains — Evidence: cadwyn
- **CORE-05** [x] Declarative operations — Evidence: cadwyn
- **CORE-06** [x] Paths — Evidence: cadwyn
- **CORE-07** [x] Schema binding — Evidence: cadwyn
- **CORE-09** [x] Error envelope — Evidence: stripe
- **CORE-12** [x] Limits — Evidence: safety
- **TYPE-01** [x] Head schemas (Zod) — Evidence: cadwyn
- **FW-01** [x] Express adapter — Evidence: adoption
- **FW-02** [x] Fastify adapter — Evidence: adoption
- **ADOPT-02** [x] Per-route opt-in — Evidence: adoption
- **ADOPT-04** [x] Init — Evidence: adoption
- **DBG-01** [x] Trace header — Evidence: adoption
- **PERF-01** [x] Head fast path — Evidence: safety
- **PERF-02** [x] Precompiled plans — Evidence: safety
- **TEST-05** [x] Test helpers — Evidence: adoption
- **SHR-01** [x] Change-file JSON Schema — Evidence: adoption
- **SHR-02** [x] Conformance suite (core ops) — Evidence: adoption

### node 0.2.0
Theme: safe to run in production.
- **CORE-08** [x] Error bodies — Evidence: stripe
- **CORE-10** [x] Released versions are frozen — Evidence: safety
- **CORE-11** [x] Purity check — Evidence: safety
- **CORE-13** [x] Query parameters — Evidence: stripe
- **TEST-08** [x] Fuzz suite — Evidence: safety
- **DBG-04** [x] Doctor — Evidence: adoption

### node 0.3.0
Theme: types for every version.
- **TYPE-02** [x] Generated per-version schemas — Evidence: cadwyn
- **TYPE-03** [x] Typed converters — Evidence: adoption
- **TYPE-04** [x] Round-trip property tests — Evidence: safety

### node 0.4.0
Theme: the CI gate.
- **TEST-01** [x] Breaking-change gate — Evidence: adoption
- **TEST-04** [x] Pull-request summary — Evidence: adoption
- **TEST-06** [x] Draft suggestion — Evidence: adoption

### node 0.5.0
Theme: docs for every version.
- **DOC-01** [x] OpenAPI per version — Evidence: cadwyn
- **DOC-02** [x] Version picker — Evidence: cadwyn
- **DOC-03** [x] API changelog — Evidence: stripe

### node 0.6.0
Theme: more frameworks.
- **FW-04** [x] Hono adapter — Evidence: adoption

### node 0.7.0
Theme: lists, streams and forms.
- **STR-01** [x] Lists and pagination — Evidence: cadwyn
- **STR-02** [x] NDJSON and SSE — Evidence: adoption
- **CORE-14** [x] Form bodies — Evidence: adoption

### node 0.8.0
Theme: correct errors and contract tests.
- **CORE-15** [x] Validation errors in the client's terms — Evidence: safety
- **TEST-02** [x] Contract fixtures — Evidence: adoption
- **TEST-03** [x] Change coverage — Evidence: adoption

### node 0.9.0
Theme: versioned webhooks.
- **EVT-01** [x] Downgrade an outgoing event — Evidence: stripe
- **EVT-02** [x] Subscriber pins — Evidence: stripe

### node 0.10.0
Theme: lifecycle.
- **LIFE-01** [x] Deprecation and Sunset headers — Evidence: rfc
- **LIFE-02** [x] Usage counters — Evidence: adoption
- **LIFE-05** [x] Pin stores (memory, Redis) — Evidence: stripe

### node 0.11.0
Theme: adopt and leave without pain.
- **ADOPT-01** [x] Existing /v1, /v2 — Evidence: adoption
- **ADOPT-03** [x] Eject — Evidence: adoption
- **DOC-04** [x] Upgrade guide per client — Evidence: stripe

### node 0.12.0
Theme: see what it does.
- **OBS-01** [x] Tracing — Evidence: adoption
- **DBG-02** [x] Explain — Evidence: adoption
- **DBG-03** [x] Logging hook — Evidence: adoption
- **PERF-03** [x] Benchmark script — Evidence: safety

### node 0.13.0
Theme: upgrade clients and retire versions.
- **LIFE-03** [x] Safe-to-remove report — Evidence: adoption
- **LIFE-04** [x] Retire a version — Evidence: adoption
- **LIFE-06** [x] Pin upgrade with preview — Evidence: stripe
- **LIFE-07** [x] Postgres pin store — Evidence: stripe

### node 0.14.0
Theme: reach.
- **FW-05** [x] Next.js adapter — Evidence: adoption
- **FW-06** [x] Koa adapter — Evidence: adoption
- **TYPE-05** [x] TypeBox and JSON Schema — Evidence: adoption
- **TEST-07** [x] Traffic replay — Evidence: safety

### node 0.15.0
Theme: clients and Node/Spring parity.
- **CLIENT-01** [x] Typed client — Evidence: adoption
- **CLIENT-02** [x] React hook — Evidence: adoption
- **SHR-03** [x] Cross-implementation gate — Evidence: adoption
- **DOC-05** [x] Type diff per version — Evidence: adoption

### node 0.16.0
Theme: tell the client which version it got.
- **CORE-16** [x] Response version header — Evidence: eval:docs/evals/core-16.md
- **CORE-17** [x] Unpinned-client header — Evidence: eval:docs/evals/core-17.md
- **LIFE-08** [x] Sunset enforcement — Evidence: eval:docs/evals/life-08.md

### node 0.17.0
Theme: headers, links, and deprecation notices.
- **CORE-18** [x] Header add and remove — Evidence: eval:docs/evals/core-18.md
- **CORE-19** [x] Link rewrite — Evidence: eval:docs/evals/core-19.md
- **CORE-20** [x] Field deprecation marker — Evidence: eval:docs/evals/core-20.md

### node 0.18.0
Theme: polymorphic resources and incoming events.
- **CORE-21** [x] Discriminator binding — Evidence: eval:docs/evals/core-21.md
- **EVT-04** [x] Upgrade an incoming event — Evidence: eval:docs/evals/evt-04.md
- **DOC-06** [x] Webhooks in per-version OpenAPI — Evidence: eval:docs/evals/doc-06.md

### node 0.19.0
Theme: inspect a body and see who never pinned.
- **DBG-05** [x] Step diff — Evidence: eval:docs/evals/dbg-05.md
- **OBS-02** [x] Unpinned counter — Evidence: eval:docs/evals/obs-02.md
- **DOC-07** [x] Upgrade matrix — Evidence: eval:docs/evals/doc-07.md

### node 0.20.0
Theme: route-level conversion you can test.
- **SHR-04** [x] Request-level conformance cases — Evidence: eval:docs/evals/shr-04.md
- **CORE-22** [x] Method change — Evidence: eval:docs/evals/core-22.md
- **CORE-23** [x] Parameter relocation — Evidence: eval:docs/evals/core-23.md
- **CORE-27** [x] Endpoint deprecation — Evidence: eval:docs/evals/core-27.md

### node 0.21.0
Theme: reshape what one route returns.
- **CORE-24** [x] Op scope — Evidence: eval:docs/evals/core-24.md
- **CORE-25** [x] Response envelope — Evidence: eval:docs/evals/core-25.md
- **CORE-26** [x] Value prefix — Evidence: eval:docs/evals/core-26.md

### node 0.22.0
Theme: finish the Nest adapter.
- **FW-03** [x] NestJS adapter — Evidence: adoption

### node 1.0.0
- API freeze per `docs/STABILITY.md`. No new IDs. Requires at least one production user named in `docs/DECISIONS.md` with their consent. Major release: the agent prepares it and stops.

## H2. Spring track (17 versions)

Spring 0.1.0 is part of the same 0.1.0 request as node 0.1.0. It is not a later project. Spring IDs that share a name with a Node ID (`CORE-08`, `EVT-01`, …) mean the same behavior, proven by the conformance suite. Spring 0.10.0 through 0.15.0 are the same IDs as node 0.16.0 through 0.21.0.

### spring 0.1.0
Theme: usable core on Spring MVC, with docs and the CI gate. Same behavior as node 0.1.0. FW-01 and FW-02 are SPR-01 and SPR-04. TYPE-01's ordered fields are the schema registry. TEST-05's helpers are SPR-09.
- **SPR-01** [x] Platform — Evidence: spring7-gap
- **SPR-02** [x] Same change files — Evidence: spring7-gap
- **SPR-04** [x] Conversion — Evidence: spring7-gap
- **SPR-05** [x] OpenAPI per version — Evidence: cadwyn
- **SPR-09** [x] Test support — Evidence: adoption
- **CORE-01** [x] Version bundle — Evidence: cadwyn
- **CORE-02** [x] Version resolution — Evidence: stripe
- **CORE-03** [x] Change-file loader — Evidence: cadwyn
- **CORE-04** [x] Conversion chains — Evidence: cadwyn
- **CORE-05** [x] Declarative operations — Evidence: cadwyn
- **CORE-06** [x] Paths — Evidence: cadwyn
- **CORE-07** [x] Schema binding — Evidence: cadwyn
- **CORE-08** [x] Error bodies — Evidence: stripe
- **CORE-09** [x] Error envelope — Evidence: stripe
- **CORE-12** [x] Limits — Evidence: safety
- **CORE-13** [x] Query parameters — Evidence: stripe
- **ADOPT-02** [x] Per-route opt-in — Evidence: adoption
- **ADOPT-04** [x] Init — Evidence: adoption
- **DBG-01** [x] Trace header — Evidence: adoption
- **PERF-01** [x] Head fast path — Evidence: safety
- **PERF-02** [x] Precompiled plans — Evidence: safety
- **STR-01** [x] Lists and pagination — Evidence: cadwyn
- **SHR-01** [x] Change-file JSON Schema — Evidence: adoption
- **SHR-02** [x] Conformance suite (core ops) — Evidence: adoption

### spring 0.2.0
Theme: operations.
- **SPR-13** [x] Actuator endpoint — Evidence: adoption
- **SPR-08** [x] Micrometer — Evidence: adoption

### spring 0.3.0
Theme: correct errors and webhooks.
- **SPR-10** [x] Bean Validation errors — Evidence: safety
- **EVT-01** [x] Downgrade an outgoing event — Evidence: stripe
- **EVT-02** [x] Subscriber pins — Evidence: stripe
  Depends on SPR-15 (spring 0.17.0).

### spring 0.4.0
Theme: lifecycle.
- **LIFE-01** [x] Deprecation and Sunset headers — Evidence: rfc
- **LIFE-03** [x] Safe-to-remove report — Evidence: adoption
- **LIFE-06** [x] Pin upgrade with preview — Evidence: stripe
  Depends on SPR-15 (spring 0.17.0).

### spring 0.5.0
Theme: reactive.
- **SPR-06** [x] WebFlux — Evidence: adoption
- **STR-02** [x] NDJSON and SSE — Evidence: adoption

### spring 0.6.0
Theme: messages.
- **SPR-07** [x] Kafka messages — Evidence: adoption
- **EVT-03** [x] Message queues — Evidence: adoption

### spring 0.7.0
Theme: fuzzing.
- **TEST-08** [x] Fuzz suite — Evidence: safety

### spring 0.8.0
Theme: modern JVM.
- **SPR-12** [x] Kotlin — Evidence: adoption

### spring 0.9.0
Theme: parity and replay.
- **SHR-03** [x] Cross-implementation gate — Evidence: adoption
- **TEST-07** [x] Traffic replay — Evidence: safety

### spring 0.10.0
Theme: tell the client which version it got. Same IDs as node 0.16.0.
- **CORE-16** [x] Response version header — Evidence: eval:docs/evals/core-16.md
- **CORE-17** [x] Unpinned-client header — Evidence: eval:docs/evals/core-17.md
- **LIFE-08** [x] Sunset enforcement — Evidence: eval:docs/evals/life-08.md

### spring 0.11.0
Theme: headers, links, and deprecation notices. Same IDs as node 0.17.0.
- **CORE-18** [x] Header add and remove — Evidence: eval:docs/evals/core-18.md
- **CORE-19** [x] Link rewrite — Evidence: eval:docs/evals/core-19.md
- **CORE-20** [x] Field deprecation marker — Evidence: eval:docs/evals/core-20.md

### spring 0.12.0
Theme: polymorphic resources and incoming events. Same IDs as node 0.18.0.
- **CORE-21** [x] Discriminator binding — Evidence: eval:docs/evals/core-21.md
- **EVT-04** [x] Upgrade an incoming event — Evidence: eval:docs/evals/evt-04.md
- **DOC-06** [x] Webhooks in per-version OpenAPI — Evidence: eval:docs/evals/doc-06.md

### spring 0.13.0
Theme: inspect a body and see who never pinned. Same IDs as node 0.19.0.
- **DBG-05** [x] Step diff — Evidence: eval:docs/evals/dbg-05.md
- **OBS-02** [x] Unpinned counter — Evidence: eval:docs/evals/obs-02.md
- **DOC-07** [x] Upgrade matrix — Evidence: eval:docs/evals/doc-07.md

### spring 0.14.0
Theme: route-level conversion you can test. Same IDs as node 0.20.0.
- **SHR-04** [x] Request-level conformance cases — Evidence: eval:docs/evals/shr-04.md
- **CORE-22** [x] Method change — Evidence: eval:docs/evals/core-22.md
- **CORE-23** [x] Parameter relocation — Evidence: eval:docs/evals/core-23.md
- **CORE-27** [x] Endpoint deprecation — Evidence: eval:docs/evals/core-27.md

### spring 0.15.0
Theme: reshape what one route returns. Same IDs as node 0.21.0.
- **CORE-24** [x] Op scope — Evidence: eval:docs/evals/core-24.md
- **CORE-25** [x] Response envelope — Evidence: eval:docs/evals/core-25.md
- **CORE-26** [x] Value prefix — Evidence: eval:docs/evals/core-26.md

### spring 0.16.0
Theme: finish the deferred Spring Done-when items (D-39).
- **SPR-03** [x] Version resolution — Evidence: spring7-gap
- **SPR-14** [x] Maven plugin — Evidence: adoption
- **CORE-10** [x] Released versions are frozen — Evidence: safety
- **CORE-14** [x] Form bodies — Evidence: adoption

### spring 0.17.0
Theme: native image.
- **SPR-11** GraalVM native image — Evidence: adoption

### spring 1.0.0
- API freeze. Same rule as node 1.0.0. Major release: the agent prepares it and stops.
