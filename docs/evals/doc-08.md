# DOC-08 — Snippets

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- Stripe's API reference shows a curl call pinned to a version. https://docs.stripe.com/api
- The three files are curl, fetch, and one Java request. Node and Spring write the same bytes so a reader can diff them.

`apiversa snippets` and `mvn apiversa:snippets` fill one template. The date and the header name are the only substitutions. Neither command calls the network.
