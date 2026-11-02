# One-time setup (a person does this once)

After this, the agents run on their own. These steps need your accounts, so no agent can do them.

## 0. Checklist

D-35 says this repo has no git remote. Nothing past §1 has happened. Leave a box empty until you have done that step.

- [ ] Repo pushed
- [ ] Remote set
- [ ] Trademark search
- [ ] npm name re-check
- [ ] `@apiversa` org
- [ ] Maven namespace verified
- [ ] Snapshots enabled

## 1. Repository
1. Create the GitHub repo `kathanp/apiversa` (public). Push this folder to `main`.
2. Create branch `next` from `main` and push it.
3. Tag the roadmap baseline: `git tag roadmap-baseline && git push origin roadmap-baseline`. The guard uses it to tell original roadmap items from later additions.
4. Settings → Branches → protect `main` and `next`:
   - require status checks: `node`, `spring`, `guard`;
   - block force pushes and deletion;
   - `main`: require 1 pull-request review (D-42). The agent opens the PR and waits.
   - `next`: do not require pull-request reviews. Pre-release merges stay on `next` without a review.
5. Settings → Security → enable private vulnerability reporting.

## 2. Agent credentials on your computer
1. Install `cursor-agent` and sign in. Check `cursor-agent --help`.
2. Install the GitHub CLI and run `gh auth login`. Use a **fine-grained token** limited to this one repository with: Contents read/write, Pull requests read/write, Actions read. Nothing else. The token cannot create tags. The owner creates stable tags (D-42).
3. Do not store npm or Maven credentials on the computer.

## 3. npm
1. Make sure the name is still free: `npm view apiversa` should return 404. Do a trademark search too.
2. Trusted publishing is configured per package, so each package must exist first. For each package (`apiversa`, `@apiversa/express`, `@apiversa/fastify`, …):
   - publish a placeholder once from your machine with 2FA: `npm publish --tag next` at version `0.0.0-placeholder.0`;
   - on npmjs.com → package → Settings → Trusted publishing: add GitHub Actions, repo `kathanp/apiversa`, workflow `publish-node.yml`.
3. Create the `@apiversa` organization on npm for the scoped packages.

## 4. Maven Central (before spring 0.1.0)
1. Sign in to the Central Portal (central.sonatype.com) with GitHub. The namespace `io.github.kathanp` is verified through your GitHub account.
2. Generate a portal user token. Add it as repo secrets `MAVEN_CENTRAL_USERNAME` and `MAVEN_CENTRAL_PASSWORD`.
3. Create a GPG key for signing. Publish the public key to a keyserver. Add `GPG_PRIVATE_KEY` and `GPG_PASSPHRASE` as repo secrets.
4. Enable SNAPSHOT publishing for the namespace in the portal if you want daily Spring snapshots.

Maven Central has no OIDC publishing, so these secrets are needed. They live only in GitHub Actions secrets.

## 5. Scheduler
Follow `docs/SCHEDULE.md` for your OS. Test with `node scripts/scheduler.mjs --dry-run`.

## 6. Hooks
```
node scripts/guard.mjs --install-hooks
```

## 7. First run
Run one slot by hand to watch it once:
```
cursor-agent -p "Run type: BUILD. Run id: manual-1. Read AGENTS.md, then follow docs/AUTOPILOT.md for this run type from section 3 to section 8."
```

## What stays yours
- Merging and tagging any `1.0.0` (the agent stops at `HS-MAJOR`).
- Fixing a hard stop the agent cannot clear.
- Optional: `npm deprecate` with 2FA after a failed release (`docs/ROLLBACK.md`).
