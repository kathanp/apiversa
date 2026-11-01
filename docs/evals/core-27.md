# CORE-27 — Endpoint deprecation

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar.

Public sources, checked 2026-10-31:

- RFC 9745 defines the `Deprecation` header. https://www.rfc-editor.org/rfc/rfc9745
- RFC 8594 defines `Sunset`. https://www.rfc-editor.org/rfc/rfc8594
- OpenAPI marks an operation `deprecated: true`. https://spec.openapis.org/oas/v3.1.0#operation-object
- LIFE-01 already sends those headers for a deprecated version date. It does not mark one route.

`endpoint.deprecate` sends the headers on every version where the route exists, including head, and marks the operation in OpenAPI from that change forward. The body is unchanged. Rejecting the call stays `endpoint.remove`.
