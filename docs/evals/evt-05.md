# EVT-05 — SQS and RabbitMQ

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- EVT-03 already converts a message body from a version header. D-29 says SQS and RabbitMQ call that header-map conversion and that those clients were not shipped.
- Spring `ApiversaMessages.convert` already takes a header map. Kafka uses it (SPR-07).

EVT-05 ships `@apiversa/sqs`, `@apiversa/rabbit`, `apiversa-sqs`, and `apiversa-rabbit`. They call the existing conversion. The host supplies the client. A failure returns no body.
