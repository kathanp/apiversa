# CLIENT-06 — Go client files

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- CLIENT-05 writes Python files with the same field rewind as CLIENT-03.
- Go callers need structs and `json` tags in registry order. The library must not invoke the `go` tool.

`apiversa generate-client --lang go` and `mvn apiversa:generate-client -Dapiversa.lang=go` write the same `generated/<schema>_<date>.go` bytes.
