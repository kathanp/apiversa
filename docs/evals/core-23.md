# CORE-23 — Parameter relocation

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar.

Public sources, checked 2026-10-31:

- Stripe has moved a value between the path, the query string, and the body across dated versions. The old client still sends it where it used to. https://docs.stripe.com/upgrades
- Cadwyn expresses the same move as a versioned request change rather than a second handler. https://github.com/zmievsa/cadwyn

`param.move` moves one value on the way up. An absent source is a no-op. A target that already holds a different value is `AV-E017` and fails the whole request (B11). Nothing is fetched.
