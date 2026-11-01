# CORE-19 — link.rewrite

Public sources, checked 2026-10-31:

- Stripe versions URL paths. The upgrades guide tells clients when a resource path changes and old integrations must keep calling the old path: https://docs.stripe.com/upgrades
- apiversa already rewrites the request path for `endpoint.rename` (B4). Bodies still return the new URL string, so an old client follows a path that version does not have.

`link.rewrite` rewrites a string field that matches the route pattern, in both directions, and leaves every non-matching value untouched. It does not fetch the URL. The schema enum grows when this ID ships.
