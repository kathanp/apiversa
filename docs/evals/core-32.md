# CORE-32 — Field copy

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- `field.alias` accepts either name and writes one name on the way down. Some breaks need the old field and the new field in the same body.
- Canonical equality is already B7. The copy op uses that equality and does not invent a second comparison.

`field.copy` writes `to` from `from` on the way down and removes an equal `to` on the way up. A different `to` is `AV-E020`. The op stays `AV-E001` until 1.4.0.
