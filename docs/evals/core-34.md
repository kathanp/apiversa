# CORE-34 — Field list

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- A single object field often becomes a one-element array in a later API version.
- STR-01 already converts each item of an existing array. It does not wrap one value into an array.

`field.list` wraps `from` into a one-element array on the way up and unwraps that array on the way down. Any other length is `AV-E023`. The op stays `AV-E001` until 1.5.0.
