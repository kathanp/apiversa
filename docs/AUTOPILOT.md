# AUTOPILOT — apiversa full-cycle agent playbook

This file runs the whole cycle with no person in the loop: pick work, write tests, write code, review, gate, commit, push, publish a pre-release, release a stable version weekly, and record it in `docs/VERSION-HISTORY.md`. The coding agent is **Cursor's `cursor-agent`**, started by `scripts/scheduler.mjs` at **9:00 AM and 9:00 PM America/Chicago**.

Read order for every run: `AGENTS.md` → this file → `docs/RULES.md` → `docs/FEATURES-SPEC.md` (Part H first) → `docs/ARCHITECTURE.md` → `.autopilot/RUN_STATE.md` (if present).

**Precedence.** `docs/RULES.md` wins over this file. This file wins over the spec on process. The spec wins on behavior. If two of them disagree, stop with `HS-CONFLICT` and write the conflict in `docs/QUESTIONS.md`.

---

## 1. Operating rules

1. No person reads or approves anything during a run. Decisions are made by the agent and logged in `docs/DECISIONS.md` as `D-<n> | <date> | <track> | <decision> | <reason>`.
2. Build only roadmap IDs from `docs/FEATURES-SPEC.md` Part H for the version being built. Never invent an ID.
3. Tests first. Never remove or change a line in an existing test or fixture. Add only.
4. Never lower a coverage threshold, mutation score, performance budget, or limit to pass a gate.
5. Never edit a file listed under `protected` in `guard.config.json`. CI compares those files with the last release tag. A difference blocks every release.
6. Never publish a **major** version (`1.0.0`, `2.0.0`, …). Prepare it and stop (`HS-MAJOR`).
7. **Launch mode** (the first 28 days after a track's first stable release, and before it): at most **one stable release per track per day**. After launch mode: at most **one every 7 days**. Hotfix patches are the only exception (section 6). The guard enforces both (`guard.config.json` → `launch`, `cooldownDays`).
8. Pre-releases go to npm dist-tag `next` and Maven `-SNAPSHOT`. Stable goes to `latest` and Maven release.
9. No secrets in code, tests, logs, or commits. No `npm login`. Publishing happens only in GitHub Actions.
10. A run lasts at most **3 hours**. Past that, commit work in progress to `wip/<run-id>` and stop.
11. Do not write run logs into the repo. Run notes live in `.autopilot/RUN_STATE.md` (gitignored).

## 2. Run types

Slot times live in `schedule.json` (defaults 9:00 AM and 9:00 PM America/Chicago). Agents do not edit it. Release rules live in `guard.config.json` (protected).

**Launch mode (first 28 days):**

| Slot (Chicago)        | Run type         | What it does                                                    |
| --------------------- | ---------------- | --------------------------------------------------------------- |
| 9:00 AM, every day    | `RELEASE`        | If the target version meets the release bar, release it. Otherwise run `BUILD` |
| 9:00 PM, every day    | `HARDEN+RELEASE` | `HARDEN`, then a release attempt if the target version is now complete |

A version that is not ready at a slot is **not forced**. It moves to the next slot automatically: morning → evening → next morning. RUN_STATE records `RELEASE PENDING <track> <version>: <reason>` so each run knows what is waiting.

**Normal mode (after 28 days):**

| Slot (Chicago)        | Run type  | What it does                                                    |
| --------------------- | --------- | --------------------------------------------------------------- |
| 9:00 AM, Tue–Sun      | `BUILD`   | Implement up to 3 roadmap IDs for the current target version    |
| 9:00 AM, Monday       | `RELEASE` | If the target version is complete and green, release it stable. Otherwise run `BUILD` |
| 9:00 PM, every day    | `HARDEN`  | No new IDs. More tests, fuzzing, mutation survivors, benchmarks, docs, bug fixes |
| After a stable release| `HISTORY` | Post-release commit to `docs/VERSION-HISTORY.md` (section 7)     |

The scheduler passes the run type in the prompt. Each run starts with section 3 and ends with section 8.

**Track choice.** Both tracks run in every slot, Node first, then Spring, each with up to 3 IDs in a `BUILD` run. When a run passes 90 minutes on Node, Spring gets the rest of the 3-hour limit. One track's failure does not stop the other. While both 0.1.0 starters are in progress, every op built in one track must get its conformance case in the same run, so the other track builds against the same expected output.

**Target version.** The lowest version in Part H for that track that is not shipped in `docs/VERSION-HISTORY.md`.

## 3. Preflight (every run)

1. `git fetch origin`. Check out `next`. Fast-forward to `origin/next`. A dirty tree or a non-fast-forward → `HS-TREE`.
2. Write the run header into `.autopilot/RUN_STATE.md`: run id (`<date>-am` or `<date>-pm`), run type, tracks, target versions.
3. If the previous slot has no marker in `.autopilot/slots/`, record `MISSED <slot>` in RUN_STATE.
4. Baseline: `node scripts/guard.mjs --gate-fast`, then the fast test command for each active track (section 9). Red baseline → this run becomes a **repair run**: fix only what is red, no new IDs.
5. Create the run branch `run/<run-id>` from `next`.

## 4. BUILD run

### 4.1 Pick
1. List the target version's IDs from Part H. Remove those already listed under that version in `CHANGELOG.md` (they are done).
2. Take up to **3** IDs in roadmap order whose dependencies are done. A dependency is any ID the spec text names.
3. Write the picks in RUN_STATE.

### 4.2 Judge (replaces the human approval)
A separate, fresh agent judges the plan. It sees only `docs/prompts/JUDGE.md`, the roadmap section for the target version, the spec sections for the picked IDs, and the plan.

```
cursor-agent -p "$(cat docs/prompts/JUDGE.md) <plan>" --output-format text > .autopilot/verdict.json
node scripts/guard.mjs --approve --file docs/FEATURES-SPEC.md --verdict .autopilot/verdict.json
```

`FAIL` → drop the failing ID for this run, log `D-n`, continue with the rest. Three `FAIL`s in a row on the same ID → move it to the next version (H0 rule 4).

### 4.3 Tests
- Write tests from the spec text only: each **Done when** line becomes at least one test. Add each **Refuses** line as a negative test.
- Node: Vitest under `node/packages/<pkg>/test/`. Spring: JUnit 5 under `spring/<module>/src/test/`.
- Add conformance cases for any op change to `conformance/fixtures/core/`.
- Tests must fail for the right reason (assertion), not import or syntax errors. Ship a stub export if needed.
- Commit on the run branch: `test(<track>): <ID> <title>`.

### 4.4 Code
- Implement until the new tests pass. Do not edit any test.
- Up to **3 attempts** per ID. Attempt 3 starts from a fresh agent given only the spec section and the failing output. After 3 → move the ID to the next version, log it.
- Commit: `feat(<track>): <ID> <title>`.

### 4.5 Review (fresh agent)
A separate agent reads `docs/prompts/REVIEW.md`, the spec section, and the diff. It answers `PASS` or `FAIL` with file:line for each question. `FAIL` sends the ID back to 4.4 and counts as an attempt.

### 4.6 Mutation
- Node: `npx stryker run` on changed files. Spring: `mvn -pl <module> org.pitest:pitest-maven:mutationCoverage`.
- Score under the F2 gate → add tests (never lower the gate) and rerun. Still under after 2 rounds → move the ID to the next version.

### 4.7 Gate, docs, merge
1. Full gate (section 9).
2. Update `CHANGELOG.md` under `## <track> <version> (unreleased)` with one line per finished ID: `- <ID> <title>`.
3. Update `docs/ARCHITECTURE.md` if a path or the event path changed. Update user docs if behavior is visible to users.
4. `node scripts/guard.mjs --verify-docs --verify-roadmap`.
5. Merge the run branch into `next` with `--no-ff`. Push `next`. CI publishes a pre-release if green.

## 5. HARDEN run

No new IDs. In this order, stopping at the 3-hour limit:
1. Fix any red check on `next` or a failing pre-release smoke test.
2. Kill surviving mutants by adding tests.
3. Add property and fuzz tests for code changed in the morning run (Node: `fast-check`; Java: jqwik).
4. Run `bench/run.mjs` (Node) and record results in `bench/results/`. Copy real numbers into `docs/BENCHMARKS.md`. A missed budget is written as missed.
5. Improve docs and examples for finished IDs.
6. Gate (section 9), commit `test(...)`, `fix(...)`, `docs(...)` or `perf(...)`, merge into `next`, push.
7. In a `HARDEN+RELEASE` run: if the target version of a track now meets every condition in section 6 step 1, run section 6 for that track. Otherwise write `RELEASE PENDING` with the reason and stop.

## 6. RELEASE run (launch mode: every morning, and the end of every evening run; normal mode: Monday 9:00 AM)

For each active track:
1. Release only if **all** hold:
   - every ID of the target version is listed in its CHANGELOG section;
   - the last two runs on `next` were green in CI;
   - `node scripts/guard.mjs --verify-release --track <t> --version <v>` passes (semver, not major, 7-day cooldown, CHANGELOG, roadmap, protected files);
   - the conformance suite passes in both tracks (SHR-03, once that ID ships).
2. If any fails → this run becomes a `BUILD` run.
3. Pre-publish tarball test (Node): `npm pack` each package, install the `.tgz` files into a new empty folder, run `examples/smoke.mjs`. Spring: `mvn -q install` then run `examples/spring-smoke` against the local artifact. Failure → `BUILD` run, log why.
4. Rename `## <t> <v> (unreleased)` to `## <t> <v> — <YYYY-MM-DD>` in `CHANGELOG.md`. Set the package or pom version. Commit `release(<t>): <v>`.
5. Open a PR `next` → `main` with `gh pr create`. Wait for required checks. Merge with a merge commit (`gh pr merge --merge`). If branch protection requires a review, stop with `HS-PROTECTION`. Never bypass it.
6. Tag `main` with `<t>-v<v>` (for example `node-v0.1.0`) and push the tag. The tag starts the publish workflow.
7. Wait for the publish workflow. It runs the stranger check on the published package and writes the result as a workflow artifact `stranger-<t>-<v>.json`.
8. Download the artifact with `gh run download`. Then run section 7.

**Hotfix.** If a stranger check fails, or a test proves a bug in a stable version, the next run may release a patch (`0.1.1`) right away, ignoring the cooldown, with only fix commits and no new IDs. Use `--verify-release --hotfix`. After 2 failed hotfixes in a row → `HS-RELEASE`.

**Major.** If the target is `1.0.0`, do steps 1–4 on a branch `release-candidate/<t>-1.0.0`, push the branch, open a PR, and stop with `HS-MAJOR`. The person merges and tags it.

## 7. HISTORY (post-release commit)

```
node scripts/guard.mjs --history-add --track <t> --version <v> --stranger stranger-<t>-<v>.json
git commit -m "history(<t>): <v>" docs/VERSION-HISTORY.md
```

- A passing stranger check writes a `shipped` entry. A failing one writes a `failed` entry and no feature is counted as shipped.
- This commit goes to `next` and reaches `main` with the next release. It is the only commit allowed to touch `docs/VERSION-HISTORY.md`.
- If the stranger check failed: `npm deprecate` is not available to the agent (no token, see `docs/ROLLBACK.md`). The next run makes a hotfix.

## 8. End of run

1. Write `.autopilot/slots/<run-id>` with the finish time.
2. Rewrite RUN_STATE: what finished, what moved, what failed, next target, any hard stop.
3. Print the run report (section 11) to stdout. The scheduler keeps the last 14 reports in `.autopilot/reports/` (gitignored).

## 9. Gates

**Fast** (preflight and after each commit):
```
node scripts/guard.mjs --gate-fast
cd node && npm run lint && npm run typecheck && npm test           # Node
cd spring && mvn -q -DskipITs test                                  # Spring
```

**Full** (before merge to `next` and before release):
```
node scripts/guard.mjs --gate-fast --verify-docs --verify-roadmap
cd node && npm run lint && npm run typecheck && npm run test:coverage && npm run conformance
cd spring && mvn -q verify
node scripts/conformance-compare.mjs     # created with SHR-03 (node 0.6.0); skip until it exists
```

`--gate-fast` = protected files unchanged versus the last release tag, tests append-only versus `origin/next`, banned test patterns, commit message format.

## 10. Hard stops

On a hard stop: commit work in progress to `wip/<run-id>`, write RUN_STATE, print the report, exit non-zero. Later runs stay in repair mode until the cause is gone.

| Code            | When                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `HS-TREE`       | Dirty tree or `next` cannot fast-forward                             |
| `HS-PROTECTED`  | A protected file differs from the last release tag                   |
| `HS-TEST-EDIT`  | Passing would need an existing test or fixture line changed          |
| `HS-LOOSEN`     | Passing would need a lower threshold, budget, limit or severity      |
| `HS-MAJOR`      | The target version is a major                                         |
| `HS-PROTECTION` | Branch protection refuses the merge                                  |
| `HS-RELEASE`    | Two failed hotfixes in a row                                         |
| `HS-CONFLICT`   | Two governing files disagree                                         |
| `HS-SECRET`     | A secret is found in the tree or a log                               |

## 11. Run report (stdout only)

```
APIVERSA RUN <run-id>  type=<BUILD|HARDEN|RELEASE>  result=<ok|repair|HS-xxx>
node   target=<v>  done=<IDs>  moved=<IDs>  tests=<n pass/n>  cov=<lines%/branches%>  mutation=<%>
spring target=<v>  done=<IDs>  moved=<IDs>  tests=<n pass/n>  cov=<lines%>  mutation=<%>
prerelease: <package@version | none>   stable: <package@version | none>
bench: <file | not run>   missed slots: <list | none>
decisions: <D-n list>
next: <one line>
```

## 12. What this setup cannot guarantee

With no person in the loop, the same agent that is told not to edit a gate can edit it. The protection is layered: protected files are compared with the last release tag in CI, the release job refuses any difference, a fresh judge and reviewer check work they did not write, and the publish workflow runs only from a tag on `main`. None of these is proof. If a run ever edits a protected file, treat every release after it as untrusted.
