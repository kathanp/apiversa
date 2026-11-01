# CORE-18 — header.add and header.remove

Public sources, checked 2026-10-31:

- Stripe's changelog adds and retires response and request headers across dated versions (for example `Stripe-Version` itself, and later headers such as `Request-Id` / idempotency headers documented per version): https://docs.stripe.com/upgrades
- The change-file model already has `header.rename` and the query trio `query.add`, `query.remove`, `query.rename` (spec B4). Header add and remove are the same absence rules (B10) applied to headers, so a header introduced at a date does not leak to older clients.

`schema/change-file.schema.json` grows when this ID ships. Until then a file that uses these ops fails startup (`AV-E001`).
