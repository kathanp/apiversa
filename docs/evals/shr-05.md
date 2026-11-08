# SHR-05 — Compatibility manifest

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- SHR-03 already blocks a release when the two libraries disagree on a conformance case. A machine-readable manifest lets a diff see dates, sunsets, and change ids without running a request.
- Version order newest-first is already the order of `supportedVersions`. Change order is already B9.

`apiversa compat` and `mvn apiversa:compat` write the same `compatibility.json`. The file lists ids from change files and does not invent one.
