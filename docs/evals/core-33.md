# CORE-33 — Field join

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- `field.split` turns one string into two fields. The opposite break keeps two older fields and writes one head string.
- The separator stays a literal. A regular expression is already refused by `field.split`.

`field.join` joins `left` and `right` on the way up and splits `from` on the way down. A present `from` on the way up is `AV-E020`. The op stays `AV-E001` until 1.5.0.
