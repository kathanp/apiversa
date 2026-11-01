# CORE-24 — Op scope

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar, and it is the weakest ID in this batch.

B6 says a change names a schema, not a route. `scope` narrows that: a field op can be limited to listed routes and to the request or the response. Without `scope`, the op still runs everywhere the schema appears. `custom` already covers a one-route exception.

The scope is chosen when the plan is compiled (PERF-02). Events never match a `routes` list. Wildcard patterns are refused. An unknown pattern fails startup with `AV-E001`.
