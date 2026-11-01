# CORE-21 — Discriminator binding

Public sources, checked 2026-10-31:

- Stripe models polymorphic resources (`PaymentMethod`, `Source`, and similar) with a type field. A version change to the card object must not rewrite a bank-account object that shares the parent resource: https://docs.stripe.com/api/payment_methods/object
- OpenAPI discriminators exist for this shape: https://spec.openapis.org/oas/v3.1.0#discriminator-object
- Cadwyn versions by schema. A shared change file has to say which variant the schema name applies to, or Node and Spring will convert the wrong object.

The registry stores one optional discriminator per schema. Variant changes run only when the mapped value matches. An unknown value is not an error; the variant changes do not run.
