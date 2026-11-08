# CORE-37 — Query version

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- CORE-02 reads the header. CORE-36, when enabled, reads the media type next.
- A query date is a third source. It has no built-in name, so the default resolution order stays the same until the host sets a name.

The host-set query name is read after the header and the media type. A header date still wins. No name means the query is ignored.
