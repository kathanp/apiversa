# apiversa

**Change your API without breaking old clients.** Stripe-style, date-based API versioning for Node.js and Spring.

> Status: **pre-release. Not yet published.** Nothing below is available on npm or Maven yet. See `docs/VERSION-HISTORY.md` for what has shipped.

## The problem

You rename a field, or a number becomes an object. Every mobile app version still on users' phones, and every partner integration, breaks. The usual answer is `/v1` and `/v2` folders: copied handlers, every bug fixed twice, nothing ever deleted.

## The idea

- Each client is pinned to a date version, like `2026-01-15`.
- You write handlers **only for the newest version**.
- Each breaking change is one small change file.
- apiversa upgrades old requests to the newest shape, runs your handler once, and downgrades the response back to the client's version.

## Quickstart (Express, planned for node 0.1.0)

```bash
npm install apiversa @apiversa/express @apiversa/zod
npx apiversa init
```

```ts
import express from 'express';
import { createApiversa } from 'apiversa';
import { apiversa } from '@apiversa/express';
import { Hotel } from './schemas';

const av = createApiversa({ dir: './api-versions', schemas: { Hotel } });
const app = express();
app.use(apiversa(av));
app.get('/hotels/:id', av.route({ response: 'Hotel' }), (req, res) => res.json(getHotel(req.params.id)));
```

```yaml
# api-versions/2026-03-01.price-object.yaml
version: "2026-03-01"
id: price-object
description: "Hotel.price changed from a number to {amount, currency}."
changes:
  - op: field.type
    schema: Hotel
    path: price
    down: { from: "price.amount" }
    up:   { value: { amount: "$.price", currency: "USD" } }
```

A client sending `Api-Version: 2026-01-15` still gets `"price": 89`. A client on `2026-03-01` gets `"price": { "amount": 89, "currency": "USD" }`. One handler.

## Why not `/v1`, `/v2`?

| | `/v1` folders | apiversa |
|---|---|---|
| Handlers per version | one copy each | one |
| Bug fixes | every copy | once |
| Old versions | stay forever | counted, then retired safely |
| Docs | written by hand | OpenAPI per version, generated |
| Breaking change slips into a PR | found by users | `apiversa check` fails CI |

## Planned for Spring

The same change files work in Spring Boot through `apiversa-spring-boot-starter`. Spring 0.1.0 is built alongside node 0.1.0. Both libraries must give byte-identical output for the same change files.

## Docs

- `docs/CHANGE-FILES.md` — how to write a change file
- `docs/MIGRATION.md` — add apiversa to an existing `/v1` API
- `docs/COMPARISON.md` — vs Cadwyn, tsadwyn, Spring 7, URL versioning
- `docs/STABILITY.md` — what counts as breaking
- `docs/FEATURES-SPEC.md` — full spec and roadmap

## License

Apache-2.0
