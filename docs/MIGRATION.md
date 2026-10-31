# Adding apiversa to an existing API

You do not need a rewrite. Start with one endpoint.

## Step 1 — Pick your versions

Give your existing URL versions dates:

| Today   | Date version |
| ------- | ------------ |
| `/v1`   | `2025-01-01` |
| `/v2`   | `2025-09-01` |

```yaml
# api-versions/versions.yaml
head: "2025-09-01"
versions:
  - date: "2025-09-01"
  - date: "2025-01-01"
default: oldest
```

## Step 2 — Map the old prefixes (ADOPT-01, planned node 0.11.0)

```ts
createApiversa({ dir: './api-versions', legacyPrefixes: { '/v1': '2025-01-01', '/v2': '2025-09-01' } });
```

`/v1/hotels/1` and `/v2/hotels/1` both reach the same head handler. Clients do not change their URLs.

## Step 3 — Move one endpoint

1. Keep the `/v2` handler. Delete the `/v1` copy.
2. Write the change file that describes how `/v1` responses differed.
3. Register the route with `av.route({ response: 'Hotel' })`.
4. Record fixtures for both versions and run `apiversa test`.

Every other route keeps working as before (ADOPT-02: only registered routes are converted).

## Step 4 — Repeat, then go header-based

When every endpoint is on apiversa, new clients send `Api-Version: <date>` and the URL prefix stops mattering.

## Step 5 — Turn on the CI gate

Add `apiversa check` to CI so a breaking change without a change file fails the pull request.

## Leaving

`apiversa eject` (planned node 0.11.0) writes all changes as plain functions and explicit routing code. You can stop using apiversa without rewriting anything.
