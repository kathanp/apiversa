# DBG-05 — Step diff

Public sources, checked 2026-10-31:

- Stripe's upgrade work is "what will this object look like after these version changes." Their versioning guide walks a single object across versions rather than only listing changelog lines: https://docs.stripe.com/upgrades
- Cadwyn's development loop is to apply the version chain to one sample and inspect the result. apiversa has `explain` for a route (DBG-02) and no command that prints each op's canonical bytes for a body the host already has.

`apiversa diff` and `mvn apiversa:diff` print those steps in B9 order. They read a local file and do not send it anywhere.
