# SPR-15 — Operator tools

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- Node already ships pin stores (LIFE-05, LIFE-07), retire (LIFE-04), legacy prefixes (ADOPT-01), eject (ADOPT-03), explain (DBG-02), the logging hook (DBG-03), doctor (DBG-04), draft change files (TEST-06), and the upgrade guide (DOC-04).
- D-57 records that Spring marked EVT-02 and LIFE-06 done without a pin store. SPR-15 is that store, plus the other Node tools listed above. Behavior matches those IDs. No new rule.

Redis and Postgres tests use the client the host passes. A missing store with `pin-on-first-call` is `AV-E005`.
