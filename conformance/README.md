# Conformance suite

Language-neutral cases that both the Node and the Spring library must pass with **byte-identical** output (spec B7, SHR-02).

Each case is a folder:

```
conformance/fixtures/core/<case>/
  versions.yaml        # the bundle
  changes/*.yaml       # change files
  case.json            # see below
```

`case.json` fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `schema` | yes | Registry name of the top value |
| `direction` | yes | `up` or `down` |
| `version` | yes | Client version. Files dated newer than this run (spec B9) |
| `input` | one of `input` or `raw` | JSON value |
| `raw` | one of `input` or `raw` | Exact JSON text the library parses. Use this for duplicate keys and number spelling |
| `expected` | success cases | JSON value. Compared as canonical bytes (spec B7) |
| `error` | failure cases | `AV-E` code. Omit `expected` |
| `fields` | no | Ordered field names for `schema`. Omitted means input key order |
| `schemas` | no | Map of nested schema name → ordered field names |

- `fixtures/core/` grows while a version is being built.
- When a version ships, its cases are copied to `fixtures/released/<track>-<version>/`. Released cases are protected (`guard.config.json`) and never change.
- A case that fails in one library blocks the release of the other (SHR-03).
