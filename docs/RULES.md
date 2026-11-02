# Rules

These rules keep every change reviewable. They win over every other file. `docs/FEATURES-SPEC.md` is the behavior. `docs/AUTOPILOT.md` is the process.

## Code (Node)

- Node.js 22 or newer. TypeScript, `strict: true`. ESM source, ESM and CJS builds. Types shipped.
- `apiversa` core has no runtime dependencies. `dependencies` stays `{}`. Adapters list their framework as a `peerDependency` only.
- One operation is one file: `node/packages/core/src/ops/<op>.ts` plus `test/ops/<op>.test.ts`.
- Public functions have TSDoc. `api-extractor` report (`node/packages/core/etc/apiversa.api.md`) changes only with a CHANGELOG line.

## Code (Spring)

- Java 17 source level. No Lombok. No reflection-based field access in the conversion path.
- `apiversa-core-java` depends only on Jackson and SnakeYAML Engine (safe loader). Spring modules depend on Spring with `provided` or `optional` scope.
- One operation is one class in `io.github.kathanp.apiversa.ops`, plus one test class.

## Both

- Converters are pure. No I/O, no clock, no randomness.
- Every collection that grows with traffic has a cap from options and a test that hits it.
- Reject `__proto__`, `constructor`, `prototype` keys.
- No `eval`, `new Function`, or regular expressions built from user files.
- No network calls in core.

## Tests

- Deterministic. No `Date.now()`, `new Date()` without an argument, `Math.random()` in tests (Node). No `System.currentTimeMillis()` or `Random` without a seed in tests (Java).
- No `.only`, `.skip`, `it.todo`, `xit`, `xdescribe`, `@Disabled` without a reason comment on the line above.
- Existing tests and fixtures are append-only. A line is never removed or changed. A file is never deleted or renamed.
- Every Refuses line has a test whose name contains the ID.
- Fake secrets are built by concatenation, never one realistic literal.

## Numbers

- Do not change a default, limit, threshold, budget or error code unless `docs/FEATURES-SPEC.md` and `CHANGELOG.md` change in the same commit, with a `docs/DECISIONS.md` line.
- A missed budget blocks the release of the version that owns that case until the case is under budget or a `docs/DECISIONS.md` line moves it.
- Do not publish a number (benchmark, coverage, adoption) unless a script in this repo produced it and the file it came from is named next to it.

## Commits

- Subject: `<type>(<track>): <summary>` where type is `feat|fix|test|docs|perf|chore|release|history` and track is `node|spring|shared`.
- One roadmap ID per `feat` commit.
- No agent co-author trailers.

## Release

- Publishing happens only in GitHub Actions from a tag on `main`.
- Stable tags on `main` are created by the owner.
- Never publish a major version from an agent run.
- Never unpublish. A broken version is fixed with a patch.
- No npm or Maven tokens on the developer machine or in the repo.
