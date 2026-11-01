# Benchmarks

Numbers here are copied from `bench/results/*.json`, which `bench/run.mjs` writes. A number with no source file fails `node scripts/guard.mjs --verify-docs`. Budgets come from `docs/FEATURES-SPEC.md` F1 and are targets, not measurements. A missed budget stays here as missed. The budget is never raised.

| Case                                         | Budget (p50) | Measured (p50) | Source       | Machine      |
| -------------------------------------------- | ------------ | -------------- | ------------ | ------------ |
| Head-version request overhead                | < 5 µs       | 1.458 µs       | `bench/results/2026-10-31.json` | darwin arm64 |
| One change, 10 KB JSON downgrade             | < 50 µs      | 64.583 µs (missed) | `bench/results/2026-10-31.json` | darwin arm64 |
| Ten changes, 10 KB JSON downgrade            | < 300 µs     | not measured   | —            | —            |
| Startup with 50 change files                 | < 200 ms     | 13.915 ms      | `bench/results/2026-10-31.json` | darwin arm64 |
| Raspberry Pi / ARM                           | —            | not measured   | —            | —            |
| Spring: one change, 10 KB JSON downgrade     | < 100 µs     | not measured   | —            | —            |
