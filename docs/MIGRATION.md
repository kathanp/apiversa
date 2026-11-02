# Adding apiversa to an existing API

You do not need a rewrite. Start with one endpoint.

## Step 1 — Pick your versions

Give your existing URL versions dates:

| Today   | Date version |
| ------- | ------------ |
| `/v1`   | `2025-01-01` |
| `/v2`   | `2025-09-01` |

```yaml
# api-versions/versions.yaml
head: "2025-09-01"
versions:
  - date: "2025-09-01"
  - date: "2025-01-01"
default: oldest
```

## Step 2 — Map the old prefixes (ADOPT-01)

```ts
createApiversa({ dir: './api-versions', legacyPrefixes: { '/v1': '2025-01-01', '/v2': '2025-09-01' } });
```

`/v1/hotels/1` and `/v2/hotels/1` both reach the same head handler. Clients do not change their URLs.

## Step 3 — Move one endpoint

1. Keep the `/v2` handler. Delete the `/v1` copy.
2. Write the change file that describes how `/v1` responses differed.
3. Register the route with `av.route({ response: 'Hotel' })`.
4. Record fixtures for both versions and run `apiversa test`.

Every other route keeps working as before (ADOPT-02: only registered routes are converted).

## Step 4 — Repeat, then go header-based

When every endpoint is on apiversa, new clients send `Api-Version: <date>` and the URL prefix stops mattering.

## Step 5 — Turn on the CI gate

Add `apiversa check` to CI so a breaking change without a change file fails the pull request.

## Spring

The same `api-versions/` folder works on Spring. Add `apiversa-spring-boot-starter`. Register each schema with an ordered field list, or `@JsonPropertyOrder`, before the first request. Mark a handler with `@ApiversaResponse("Hotel")`. Routes without that annotation are untouched.

```xml
<dependency>
  <groupId>io.github.kathanp</groupId>
  <artifactId>apiversa-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

WebFlux uses `apiversa-webflux` with the same `apiversa.*` settings. Boot 3.3 uses apiversa's resolver. Framework 7 apps use `apiversa-spring-framework7`. Spring MVC converts a form body before the form converter. A repeated form key still keeps the last value (D-41).

## From Cadwyn

Cadwyn versions are Python classes. apiversa versions are dates in `versions.yaml` plus one YAML change file per breaking change.

1. Pick a date for each Cadwyn version, newest first, and set `head` to the newest date.
2. For each Cadwyn `schema(...).had(...)` or `.didnt_have(...)` instruction, write the matching op from Part B: a renamed field is `field.rename`, a removed field is `field.remove`, a type change is `field.type`.
3. Keep one head FastAPI-equivalent handler. Delete the older handler copies.
4. Run `apiversa check` and `apiversa test`. Cadwyn's generated changelog route is `apiversa changelog`.

Cadwyn 8.2.0 (PyPI, 2026-11-01) is the version this section was written against. Re-check `docs/COMPARISON.md` before you quote a newer one.

## From Spring 7 versioning

Spring Framework 7 routes a request to a different handler per version. It does not convert the body. apiversa keeps one handler and converts.

1. Leave the head handler in place. Remove the older version handlers.
2. Write a change file for each shape those older handlers accepted or returned.
3. On Boot 3.3, apiversa resolves `Api-Version` itself. On Framework 7, `apiversa-spring-framework7` implements `ApiVersionResolver` and delegates to `Engine.resolve`.
4. If you only needed a different handler per version and no body conversion, Spring 7's built-in resolver is enough. You do not need apiversa.

## Remove apiversa from one route

1. Delete the apiversa registration for that route only: the `av.route(...)` call, the Express or Fastify wrapper, `@ApiversaResponse`, or the Nest `ApiversaRoute` on that handler.
2. Leave `api-versions/` in place. Other registered routes keep converting.
3. The route now returns the handler's head shape to every client. Old clients of that one route see the head fields.
4. Run the route's tests without an `Api-Version` header and confirm the head body.

## Leaving

`apiversa eject` writes `ejected/changes.mjs` and `ejected/routes.mjs`: one `up` and one `down` function per change, and the endpoint list. The files do not import apiversa.

```bash
npx apiversa eject ./api-versions --out ./ejected
npx apiversa upgrade-guide --from 2025-01-01 ./api-versions
```

The upgrade guide lists every change newer than that date, grouped by endpoint.
