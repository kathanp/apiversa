# SHR-07 — Bundle diff

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- SHR-05 writes one bundle's dates and change ids.
- A release review needs the dates and change-file bytes that differ between two directories the host already has. The command must not copy either directory.

`apiversa bundle-diff` and `mvn apiversa:bundle-diff` write the same `bundle-diff.json`. A directory that fails to load exits 1 with `AV-E001` and does not leave `--out`.
