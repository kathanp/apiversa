# CORE-31 — Field split

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- A full name becoming `first` and `last` is a normal breaking change. `field.rename` and `field.move` move one value. They do not split it.
- Part G forbids endpoint split, because that runs a handler more than once. `field.split` rewrites one JSON value and runs the handler once.

The separator is a literal string. A regular expression is rejected at startup. Both names present on the way up is `AV-E020`. A missing separator is `AV-E021`.
