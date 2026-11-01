# EVT-04 — Upgrade an incoming event

Public sources, checked 2026-10-31:

- Stripe signs and delivers events in the subscriber's pinned version. A consumer that stores those bodies, or a partner that posts an old event shape back, has to bring them up to the current object before the current handler can read them: https://docs.stripe.com/api/events/object and https://docs.stripe.com/webhooks
- EVT-01 already runs the response `down` chain as `downgradeEvent`. There is no matching `up` entry point for a payload that is not an HTTP request.

`upgradeEvent` runs the same `up` chain as `convertRequest` for that schema and version. It does not perform I/O.
