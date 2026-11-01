# CORE-22 — Method change

Author-written eval, 2026-10-31. There is no external issue. This is a weak bar.

Public sources, checked 2026-10-31:

- Stripe has moved a call from one HTTP method to another across versions. The client keeps the old method; the server handles the new one. https://docs.stripe.com/upgrades
- Fastify sets `rewriteUrl` when the server is created and does not rewrite the method after routing. https://fastify.dev/docs/latest/Reference/Server/#rewriteurl
- Spring MVC maps the method in `DispatcherServlet`. A body `RequestBodyAdvice` runs after that mapping, so a method change has to be a `Filter` ahead of dispatch. https://docs.spring.io/spring-framework/reference/web/webmvc/filters.html

`endpoint.method` rewrites before routing. Fastify registers the old method as a shim that calls the head handler directly. A head request with the old method is left to the framework's 404 or 405. The handler runs once (B11).
