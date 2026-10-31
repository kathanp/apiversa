# Contributing

Thanks for helping. Most of this project is built by an automated agent pipeline (`docs/AUTOPILOT.md`), so outside contributions follow the same rules the agent does.

## Before you start

- Open an issue first for anything bigger than a typo. New features must be on the roadmap (`docs/FEATURES-SPEC.md` Part H). An issue from a user is the evidence that lets a feature onto the roadmap.
- Read `docs/RULES.md`.

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

## What gets declined

- Features not on the roadmap without an issue showing a real need.
- Changes that lower a coverage, mutation, or performance gate.
- New runtime dependencies in `apiversa` core or `apiversa-core-java`.
