# Benchmarks

Numbers here are copied from `bench/results/*.json`, which `bench/run.mjs` writes. A number with no source file fails `node scripts/guard.mjs --verify-docs`. Budgets come from `docs/FEATURES-SPEC.md` F1 and are targets, not measurements. A missed budget stays here as missed. The budget is never raised.

| Case                                         | Budget (p50) | Measured (p50) | Source       | Machine      | Release |
| -------------------------------------------- | ------------ | -------------- | ------------ | ------------ | ------- |
| Head-version request overhead                | < 5 µs       | 1.458 µs       | `bench/results/2026-10-31.json` | darwin arm64, Apple M1. Node version was not stored in that file. This machine is Node v18.16.0 | does not block |
| One change, 10 KB JSON downgrade             | < 50 µs      | 64.583 µs (missed) | `bench/results/2026-10-31.json` | darwin arm64, Apple M1. Node version was not stored in that file. This machine is Node v18.16.0 | blocks release |
| Ten changes, 10 KB JSON downgrade            | < 300 µs     | not measured   | —            | Apple M1. Measure in the next HARDEN run | blocks release |
| Startup with 50 change files                 | < 200 ms     | 13.915 ms      | `bench/results/2026-10-31.json` | darwin arm64, Apple M1. Node version was not stored in that file. This machine is Node v18.16.0 | does not block |
| Raspberry Pi / ARM                           | —            | not measured   | —            | —            | does not block |
| Spring: one change, 10 KB JSON downgrade     | < 100 µs     | not measured   | —            | Apple M1. Measure in the next HARDEN run | blocks release |
| tsadwyn, one change, 10 KB JSON downgrade    | —            | not measured   | `bench/run.mjs` on this machine, next HARDEN run | Apple M1 | does not block |
