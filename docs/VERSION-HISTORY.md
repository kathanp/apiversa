# Version history

What actually shipped. The plan is in `docs/FEATURES-SPEC.md` Part H. This file records facts only.

Rules (checked by `node scripts/guard.mjs --verify-roadmap`):

1. An entry is written only by `node scripts/guard.mjs --history-add` after the stranger check runs on the **published** package.
2. A failed or broken release is recorded as `failed`. No feature counts as shipped from it.
3. Every feature in a `shipped` entry must be listed in that version's roadmap section. Anything else is scope creep and fails the gate.
4. Node and Spring have separate entries (`node 0.3.0`, `spring 0.1.0`).
5. Entries are written in a separate `history(<track>): <version>` commit after the release, never inside a build run.
6. Entries are never edited or deleted.

Entry format:

```
## <track> <x.y.z> — <YYYY-MM-DD> — <shipped|failed>
- Package: <name>@<x.y.z>
- Features: <ID, ID, ...>
- Stranger check: <pass|FAIL> (<time>)
```

<!-- entries: newest first -->
