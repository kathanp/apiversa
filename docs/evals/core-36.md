# CORE-36 — Media type version

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- CORE-02 already reads the version header first. Some APIs put the date on `Content-Type` instead.
- A 1.x minor must not change the default. The media type is read only when the host turns the option on.

`mediaType: true` or `apiversa.media-type=true` reads `version` from `Content-Type` after the header is absent. A header date still wins. The option left off ignores `Content-Type`.
