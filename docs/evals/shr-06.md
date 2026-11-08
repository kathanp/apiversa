# SHR-06 — Client byte check

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- SHR-03 already fails when Node and Spring disagree on a conformance case.
- CLIENT-05 and CLIENT-06 add generated files. Those files need the same comparison without writing them to disk.

`apiversa clients --check` and `mvn apiversa:clients -Dapiversa.check=true` compare the Python file and the Go file to the fixture in memory. A difference exits 1 and writes nothing.
