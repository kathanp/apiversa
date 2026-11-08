# CORE-29 — Field alias

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- Stripe keeps an old field name working for a window while clients move to the new name. https://docs.stripe.com/api/versioning
- `field.rename` accepts only the old name on the way up. Teams still need one window that accepts both names.

`field.alias` accepts `from` or `to` on the way up. Both keys present is `AV-E018`. Down writes `from` only. The op stays `AV-E001` until node 1.2.0 and spring 1.2.0 ship.
