# CORE-20 — field.deprecate

Public sources, checked 2026-10-31:

- Stripe marks fields deprecated in a version before a later version removes them, and the changelog is the notice: https://docs.stripe.com/upgrades
- OpenAPI 3.1 `deprecated: true` on a schema property is the machine-readable form of that notice: https://spec.openapis.org/oas/v3.1.0#schema-object

`field.deprecate` changes no JSON bytes. Per-version OpenAPI and `apiversa changelog` record it. Removal stays `field.remove`. The schema enum grows when this ID ships.
