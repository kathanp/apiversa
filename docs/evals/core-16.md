# CORE-16 — Response version header

Public sources, checked 2026-10-31:

- Stripe sends the version back on the response. The versioning guide says every request can set `Stripe-Version`, and the API response identifies the version that handled it: https://docs.stripe.com/api/versioning
- GitHub's REST API does the same with `X-GitHub-Api-Version` on the response: https://docs.github.com/en/rest/about-the-rest-api/api-versions

apiversa already resolves one date per request (CORE-02) and does not tell the client which date won when the header was absent or a pin store supplied it. CORE-16 writes that resolved date on the response, using the configured header name, and still does not parse a body whose plan is empty.
