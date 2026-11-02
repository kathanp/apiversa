# Benchmarks

Numbers here are copied from `bench/results/*.json`, which `bench/run.mjs` writes. A number with no source file fails `node scripts/guard.mjs --verify-docs`. Budgets come from `docs/FEATURES-SPEC.md` F1 and are targets, not measurements. A missed budget stays here as missed. The budget is never raised.

`bench/run.mjs` measures three cases. Ten changes, the Spring downgrade, Raspberry Pi, and tsadwyn are not measured by that script. Those rows stay unmeasured.

| Case | Budget (p50) | Measured (p50) | Source | Machine | Release |
| --- | --- | --- | --- | --- | --- |
| Head-version request overhead | < 5 µs | 1.458 µs | `bench/results/2026-11-01.json` | darwin arm64, Apple M1, Node v22.23.3 | does not block |
| One change, 10 KB JSON downgrade | < 50 µs | 68.167 µs (missed) | `bench/results/2026-11-01.json` | darwin arm64, Apple M1, Node v22.23.3 | blocks release |
| Ten changes, 10 KB JSON downgrade | < 300 µs | not measured | — | — | blocks release |
| Startup with 50 change files | < 200 ms | 14.945 ms | `bench/results/2026-11-01.json` | darwin arm64, Apple M1, Node v22.23.3 | does not block |
| Raspberry Pi / ARM | — | not measured | — | — | does not block |
| Spring: one change, 10 KB JSON downgrade | < 100 µs | not measured | — | — | blocks release |
| tsadwyn, one change, 10 KB JSON downgrade | — | not measured | — | — | does not block |
