# Comparison

Checked on 2026-11-01 from public pages, the npm registry, PyPI, and the GitHub API. These facts change. Re-check every row before quoting it anywhere, and update the date.

| Option | What it is | Status on 2026-11-01 | Source |
| --- | --- | --- | --- |
| **Cadwyn** | Stripe-style versioning for Python FastAPI. The model this project follows | 8.2.0, uploaded to PyPI on 2026-11-01. GitHub: 313 stars, 53 forks | https://pypi.org/project/cadwyn/ and https://github.com/zmievsa/cadwyn |
| **tsadwyn** | "Stripe-like API versioning framework for TypeScript/Express" | Version 0.1.0, published once on 2026-04-18, no update since | `npm view tsadwyn` |
| **express-api-versioning** | Loads a different code folder per URL version | 2.0.0, registry modified 2024-09-28 | `npm view express-api-versioning` |
| **express-routes-versioning** | Picks a route handler by version | 1.0.1, registry modified 2022-06-17 | `npm view express-routes-versioning` |
| **Spring Framework 7 API versioning** | Built-in version resolution and routing to handlers per version | Shipped in Spring Framework 7 / Boot 4. Routes only; no request/response conversion | https://docs.spring.io/spring-framework/reference/7.0/web/webmvc-versioning.html |
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
