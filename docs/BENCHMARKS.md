# Benchmarks

Numbers here are copied from `bench/results/*.json`, which `bench/run.mjs` writes. A number with no source file fails `node scripts/guard.mjs --verify-docs`. Budgets come from `docs/FEATURES-SPEC.md` F1 and are targets, not measurements. A missed budget stays here as missed. The budget is never raised.

| Case                                         | Budget (p50) | Measured (p50) | Source       | Machine      |
| -------------------------------------------- | ------------ | -------------- | ------------ | ------------ |
| Head-version request overhead                | < 5 µs       | not measured   | —            | —            |
| One change, 10 KB JSON downgrade             | < 50 µs      | not measured   | —            | —            |
| Ten changes, 10 KB JSON downgrade            | < 300 µs     | not measured   | —            | —            |
| Startup with 50 change files                 | < 200 ms     | not measured   | —            | —            |
| Raspberry Pi / ARM                           | —            | not measured   | —            | —            |
| Spring: one change, 10 KB JSON downgrade     | < 100 µs     | not measured   | —            | —            |
