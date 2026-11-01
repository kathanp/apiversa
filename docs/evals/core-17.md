# CORE-17 — Unpinned-client header

Public sources, checked 2026-10-31:

- Stripe's versioning guide treats an explicit version as the normal case. An account has a default version, and official libraries send `Stripe-Version` so a client is not silently left on that default: https://docs.stripe.com/api/versioning
- RFC 9111 marks the HTTP `Warning` header obsolete, so this library does not use it: https://www.rfc-editor.org/rfc/rfc9111#section-5.5

When resolution falls through to the `default` policy, the response carries `Apiversa-Default` set to that date. An explicit header or a resolver pin does not. The status code stays whatever the handler or the error envelope already chose.
