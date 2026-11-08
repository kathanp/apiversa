# CLIENT-03 — Java client

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- CLIENT-01 is the Node `fetch` client. It sends the pinned version header and returns the type for that date. Spring has no matching client.
- Kotlin is already a Spring surface (SPR-12). The Kotlin client calls the Java client. It does not generate a second set of records.

`apiversa-client` takes the host's `HttpClient`. `mvn apiversa:generate-client` writes one record per schema per date. `mvn apiversa:snippets` writes the DOC-08 bytes.
