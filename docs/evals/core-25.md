# CORE-25 — Response envelope

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar.

Public sources, checked 2026-10-31:

- Stripe list endpoints return `{ data, has_more, url }` rather than a bare array. Older clients of a similar API often received the array. https://docs.stripe.com/api/pagination
- STR-01 already converts each item of a page. It does not replace the page object with the array.

`response.envelope` does that replacement on the way down, for the first page only. It does not follow `next_cursor`. With `cursorHeader`, the cursor is copied to a response header. A non-array `items` value is `AV-E016`. Docs must say the conversion is lossy.
