# CORE-28 — Named bundles

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- Stripe accounts run more than one API product. Each product has its own version timeline. https://docs.stripe.com/api/versioning
- One `dir` today is one bundle. A second product in the same process needs a second directory and a second head.

`bundles` adds named directories. A route names the bundle. One `dir` and no name stays the current configuration. Dates do not leak across bundles.
