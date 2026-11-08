# DOC-09 — AsyncAPI per version

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- AsyncAPI 3.0.0 describes Kafka, SQS, and RabbitMQ payloads. https://www.asyncapi.com/docs/reference/specification/v3.0.0
- DOC-01 already rewinds response schemas per date. Message payloads use that same rewind. The channel list stays the head list.

`apiversa asyncapi` and `mvn apiversa:asyncapi` write one file per date. A missing input file writes nothing and exits 0.
