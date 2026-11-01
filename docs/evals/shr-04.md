# SHR-04 — Request-level conformance cases

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar: it records a gap in this spec, not a request from a user.

`conformance/fixtures` cases today carry a body (`input` or `raw`) and compare body bytes. `endpoint.rename`, `query.*`, `header.*`, and `status.change` are already in B4, and H0 rule 8 asks for a conformance case per op. A body-only `case.json` cannot state a method, a path, a query list, or a status.

The case format needs an optional `request` and, on the way down, a `response`, so Node and Spring can compare those fields the same way they compare bodies (B7, B12). Cases stay about the request, not about Express or Spring.
