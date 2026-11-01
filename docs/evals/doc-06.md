# DOC-06 — Webhooks in per-version OpenAPI

Public sources, checked 2026-10-31:

- Stripe publishes each event payload in the version the subscriber is pinned to. The event object and the resource object both change by version: https://docs.stripe.com/api/events/object
- OpenAPI 3.1 has a top-level `webhooks` map for that contract: https://spec.openapis.org/oas/v3.1.0#openapi-object

`apiversa openapi` and the Spring per-version document rewind each webhook schema with the same rules as a response schema (DOC-01). A head document with no `webhooks` key produces none.
