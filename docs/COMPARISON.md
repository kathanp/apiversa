# Comparison

Checked on 2026-11-01 from public pages, the npm registry, PyPI, and the GitHub API. These facts change. Re-check every row before quoting it anywhere, and update the date.

| Option | What it is | Status on 2026-11-01 | Source |
| --- | --- | --- | --- |
| **Cadwyn** | Stripe-style versioning for Python FastAPI. The model this project follows | 8.2.0, uploaded to PyPI on 2026-11-01. GitHub: 313 stars, 53 forks | https://pypi.org/project/cadwyn/ and https://github.com/zmievsa/cadwyn |
| **tsadwyn** | "Stripe-like API versioning framework for TypeScript/Express" | Version 0.1.0, published once on 2026-04-18, no update since | `npm view tsadwyn` |
| **express-api-versioning** | Express middleware that loads a different API version from the version in the request URL | 2.0.0, registry modified 2024-09-28 | `npm view express-api-versioning` |
| **express-routes-versioning** | "Node.js module provides versioning for expressjs routes/api" | 1.0.1, registry modified 2022-06-17 | `npm view express-routes-versioning` |
| **Spring Framework 7 API versioning** | The 7.0 page documents version resolution, request mapping, and deprecation headers | Shipped in Spring Framework 7. Body conversion is not described on that page | https://docs.spring.io/spring-framework/reference/7.0/web/webmvc-versioning.html |
| **Stripe** | Runs date-based versioning internally | Not released as a library | https://docs.stripe.com/api/versioning |
| **`/v1` folders** | Copy handlers per version | Common practice | — |

## What apiversa does differently

- Same change files in Node and Java, with a conformance suite that checks identical output.
- A CI gate that fails when the head changes without a change file.
- Usage counts per version and change, so old versions can be retired with evidence.

Compile-time types stay off this list until TYPE-03 has a published example.

## What the others do better today

- **Cadwyn** is released (8.2.0, 2026-11-01), used, and documented. apiversa is not published yet.
- **Spring 7 built-in versioning** needs no extra dependency. For teams that only need routing by version, it is enough.
- **`/v1` folders** need no new concept. For an API with one or two versions and no outside clients, they are simpler.

Do not publish adoption, download, or performance claims in this file unless a script in this repo produced them.

## A4 re-check, 2026-11-01

| A4 row | Result |
| --- | --- |
| Write head only | Cadwyn docs say you keep the newest implementation and older versions are generated. The tsadwyn readme shows head schemas plus request and response migration. The Spring 7.0 page documents routing and resolution, not body conversion. |
| Same change files in Node and Java | Cadwyn is Python/FastAPI. tsadwyn is TypeScript/Express. Spring's page is the Java framework. |
| Compile-time type check of each version | unverified. None of the fetched pages say whether each older version is type-checked. |
| CI gate: head changed without change file | unverified. The tsadwyn readme has a CI badge for its own repo. That is not this gate. |
| Versioned webhooks | unverified. Not on the Cadwyn docs home page, the tsadwyn readme, or the Spring 7.0 page. |
| Usage per version and a safe-to-delete report | unverified. Not on those pages. |
| Framework list | Cadwyn's GitHub description says FastAPI. tsadwyn's npm description says Express. The Spring page is Spring MVC. |
