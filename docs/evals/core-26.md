# CORE-26 — Value prefix

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar.

Public sources, checked 2026-10-31:

- Stripe object IDs are prefixed strings (`ch_`, `cus_`, `price_`) where an older API sometimes used a bare id. https://docs.stripe.com/api
- B7 already defines the canonical decimal form of a safe integer. The prefix op uses that spelling and does not invent a second number format.

`value.prefix` adds or strips one fixed prefix. `numeric: true` emits a safe integer when the remainder is digits only. A non-matching string stays. Regular expressions, suffixes, and other string transforms stay on `custom`.
