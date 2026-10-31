# Rollback

What happens when a published version is broken.

## Rules

- Never unpublish. npm allows it only in narrow cases, and it breaks every lockfile that already resolved the version.
- Fix forward with a patch release.

## npm

Stable versions are published straight to the `latest` dist-tag through trusted publishing (OIDC), after the pre-publish tarball test passes. No long-lived npm token exists in CI. That means the pipeline **cannot** run `npm deprecate` or move dist-tags by itself.

When the post-publish stranger check fails:
1. The publish workflow uploads `stranger-node-<v>.json` with `"pass": false`.
2. The next agent run records the version as `failed` in `docs/VERSION-HISTORY.md`.
3. The same run makes a hotfix (`x.y.(z+1)`) with fix commits only. The 7-day cooldown does not apply to hotfixes.
4. After 2 failed hotfixes in a row, the agent stops with `HS-RELEASE`.
5. A person can run `npm deprecate apiversa@<v> "broken, use <v+1>"` from their own machine with 2FA. This is optional.

If you later decide to give CI a granular npm token limited to this package, the publish workflow can deprecate automatically. That is a trade: an automatic deprecate, against a stored write token.

## Maven Central

Releases on Maven Central are permanent. A broken release is fixed by the next patch release. The agent records it as `failed` in the version history the same way.

## Pre-releases

`next` pre-releases and snapshots carry no promise. A broken one is replaced by the next run. It is not recorded in the version history.
