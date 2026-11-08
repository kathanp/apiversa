# CORE-30 — Rewrite a JSONL file

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- Teams store webhook and API bodies in files and object stores. Those lines stay in the old shape after the API moves on.
- CORE-12 already caps an array at 10,000 items. The rewrite command uses that number. It does not add a second limit.

`apiversa rewrite` and `mvn apiversa:rewrite` convert one JSON value per line. A failure deletes the output. The command does not open a socket.
