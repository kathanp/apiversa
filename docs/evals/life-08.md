# LIFE-08 — Sunset enforcement

Public sources, checked 2026-10-31:

- Stripe keeps old versions available and then retires them. After retirement, calls on that version stop succeeding; the upgrades guide is the client-facing record: https://docs.stripe.com/upgrades and https://docs.stripe.com/api/versioning
- RFC 8594 defines the `Sunset` header LIFE-01 already sends. It does not by itself reject traffic: https://www.rfc-editor.org/rfc/rfc8594

`sunset` today only sets that header. `sunsetEnforce: true` is opt-in. When the sunset date is strictly before the UTC date in the `now` option (or the UTC date at the request when `now` is omitted), the version returns `AV-E012`. Without the flag, behavior stays the header only. The schema accepts `sunsetEnforce` when this ID ships.
