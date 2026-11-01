# DOC-07 — Upgrade matrix

Public sources, checked 2026-10-31:

- Stripe's upgrades page is the list of changes between the version a client is on and the version they would move to: https://docs.stripe.com/upgrades
- DOC-04 writes that list for one `--from` date. Mobile and partner clients need the same list for every supported date, in the order the chain actually runs (B9), so a generated client can show "you will cross these changes."

`apiversa matrix` and `mvn apiversa:matrix` write that JSON. Descriptions come from the change files. No network.
