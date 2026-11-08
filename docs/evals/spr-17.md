# SPR-17 — WebSocket text frame

Author-written eval, 2026-11-08. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-08:

- SPR-16 upgrades one message, calls the host function once, and downgrades the payload. The module does not open a socket.
- A WebSocket text frame is the same shape. The host already owns the session and passes the handshake headers.

`apiversa-websocket` gives the handler the head JSON and returns the downgraded text. An unknown date is `AV-E002` and the handler is not called.
