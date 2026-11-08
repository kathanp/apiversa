# TEST-09 — Pact file

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- TEST-07 replays samples the host exported. It does not send them.
- A pact file is another host-supplied file. Each interaction already carries a version date. The library can upgrade the request and downgrade the response without calling the provider.

`apiversa pact` and `mvn apiversa:pact` write the same result bytes. An unknown date is `AV-E002` for that interaction. Any failure exits 1 and does not leave `--out`. A missing input writes nothing and exits 0.
