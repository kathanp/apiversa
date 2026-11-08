# SPR-16 — Spring Cloud Function

Author-written eval, 2026-11-07. There is no external issue. This is a weak bar.

Public sources, checked 2026-11-07:

- Spring Cloud Function is the Spring entry for a function that is not an MVC controller. The payload is a Spring `Message`. https://docs.spring.io/spring-cloud-function/reference/
- FW-07 is the Node Lambda adapter. This module is the Spring counterpart. It does not ship an AWS SDK.

The wrapper upgrades the incoming payload, calls the host function once, and downgrades the result. An unknown date does not call the function.
