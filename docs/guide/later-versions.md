# Versions 0.12 through 0.19

These calls are in the libraries. Nothing here publishes a release.

## See the chain

`apiversa explain --version 2025-10-01 --route "GET /hotels/:id"` prints each step and a before/after of `{ "sample": true }`. `onConvert` receives `{ change, direction, ms }` for each applied step. `@apiversa/otel` `startConversion` records one span when the date is not head.

## Retire and pins

`safeToRemove()` lists versions and changes with no process-local requests. `apiversa retire 2025-10-01` reads `api-versions/usage.json` and refuses a date that still has requests unless `--force`. `previewUpgrade(clientId, toDate)` lists the changes between the pin and that date. `upgradePin` refuses a backwards move unless `allowDowngrade` is true. `@apiversa/pin-postgres` `postgresPins(client)` uses the host's pool.

## Clients and adapters

`@apiversa/next` `route(av, decl, handler)` wraps one App Router handler. `@apiversa/koa` does the same for Koa. `@apiversa/client` `createClient` sends `Api-Version`. `@apiversa/react` `ApiVersionProvider` and `useApiVersion()` read that client. `@apiversa/json-schema` builds a registry from a JSON Schema or TypeBox object.

## What the response says

The response `Api-Version` header is the resolved date. `Apiversa-Default` is set only when the default policy chose it. A version with `sunsetEnforce: true` and a past `sunset` returns `410` / `AV-E012`. Without the flag, the handler still runs and the `Sunset` header is sent.

`header.add` and `header.remove` follow the same absence rules as fields. `link.rewrite` rewrites one string path (`:param` segments). `field.deprecate` does not change the body; OpenAPI marks the property deprecated from that version forward.

A schema discriminator runs a variant's changes only when the string at its path matches. `upgradeEvent(payload, schema, version)` runs the `up` chain. `apiversa diff` prints each step and the canonical body. `apiversa matrix` writes `upgrade-matrix.json`. Spring has the same `diff` and `matrix` goals.
