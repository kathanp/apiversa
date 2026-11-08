# CORE-35 — Null for an absent field

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- B10 already treats a missing key and JSON `null` as different.
- `field.add` leaves a present `null` as `null` and does not turn an absent key into `null` unless the default is `null`. Removing a non-null value is a different op.

`field.null` writes JSON `null` for an absent key on the way up and removes a JSON `null` on the way down. `0`, `false`, and `""` stay. The op stays `AV-E001` until 1.5.0.
