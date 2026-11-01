# OBS-02 — Unpinned counter

Public sources, checked 2026-10-31:

- Stripe can tell an integrator which version their account is on because the version is stored. A client that never sends a version is the one that breaks when the default moves. Their guide tells libraries to send the header: https://docs.stripe.com/api/versioning
- LIFE-02 counts requests per version and refuses to export them. It does not count how many of those requests arrived with no version header and no pin.

`unpinned` increments only when the `default` policy chose the date. `stats()`, Prometheus text, the Micrometer meter, and the actuator report expose that count. Nothing is sent off the process.
