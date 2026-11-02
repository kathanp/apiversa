# Contributing

Thanks for helping. Most of this project is built by an automated agent pipeline (`docs/AUTOPILOT.md`), so outside contributions follow the same rules the agent does.

## Setup

Node.js 22 or newer. Java 17 or newer.

```
git clone <repo-url>
cd apiversa
cd node && npm ci
cd ../spring && mvn -q install
```

The repo has no remote yet (D-35). Clone from the path you were given until §0 of `docs/SETUP.md` is done.

## Before you start

- Open an issue first for anything bigger than a typo. New features must be on the roadmap (`docs/FEATURES-SPEC.md` Part H). An issue from a user is the evidence that lets a feature onto the roadmap.
- Read `docs/RULES.md`.
- Vulnerabilities go through `SECURITY.md`. Do not open a public issue for those.

## Pull requests

1. Tests first. Add tests; never change or delete an existing test line.
2. Commit subjects: `<feat|fix|test|docs|perf|chore>(<node|spring|shared>): <summary>`.
3. Run before pushing:
   ```
   node scripts/guard.mjs --gate-fast
   cd node && npm run lint && npm run typecheck && npm test
   cd spring && mvn -q verify
   ```
4. A change to an op must add a conformance case under `conformance/fixtures/` and pass in both Node and Spring.

## How to add a conformance case

Create `conformance/fixtures/core/<name>/case.json`. Point it at a change file under `changes/` when the case needs one. A body case looks like this:

```json
{
  "schema": "Booking",
  "fields": ["id", "guestCount"],
  "direction": "up",
  "version": "2026-01-15",
  "input": { "id": "b_1" },
  "expected": { "id": "b_1", "guestCount": 1 }
}
```

`direction` is `up` or `down`. `expected` is the bytes both libraries must produce. Changing `expected` on an existing case is a breaking change (`docs/STABILITY.md`): a minor version and a line in `docs/DECISIONS.md`. A Refuses test's name contains the roadmap ID.

## What gets declined

- Features not on the roadmap without an issue showing a real need.
- Changes that lower a coverage, mutation, or performance gate.
- New runtime dependencies in `apiversa` core or `apiversa-core-java`.
