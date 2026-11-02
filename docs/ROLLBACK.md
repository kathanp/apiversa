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

The owner publishes that patch. The agent token cannot create the tag (D-42). After the owner tags `spring-v<x.y.z>` on `main`, the publish workflow uploads the Maven artifacts. There is no unpublish step and no guaranteed clock time. The patch ships on the next green release run after the owner tags it. Until that tag exists, users stay on the broken version.

## Pre-releases

`next` pre-releases and snapshots carry no promise. A broken one is replaced by the next run. It is not recorded in the version history.

## Repoint `next`

`next` is the branch and the npm dist-tag.

1. Branch: `git fetch origin` and `git checkout next`. To drop a bad commit, the owner resets `next` to the last good commit and force-pushes. The agent does not force-push. Branch protection blocks force-push until the owner allows that one push.
2. npm dist-tag: from the owner's machine, with 2FA, `npm dist-tag add <package>@<good-version> next`. The CI token cannot move tags.
3. Maven snapshots: the next snapshot publish replaces the snapshot. There is no tag to move. A consumer who pinned the bad snapshot timestamp must rebuild after the next snapshot.

Do this before any stable PR is merged. A stable version that already reached `main` is fixed by a patch, not by moving `next`.
