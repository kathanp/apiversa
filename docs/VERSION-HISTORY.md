# Version history

What actually shipped. The plan is in `docs/FEATURES-SPEC.md` Part H. This file records facts only.

Rules (checked by `node scripts/guard.mjs --verify-roadmap`):

1. An entry is written only by `node scripts/guard.mjs --history-add` after the stranger check runs on the **published** package.
2. A failed or broken release is recorded as `failed`. No feature counts as shipped from it.
3. After a track's first shipped entry, every feature in a `shipped` entry must be listed in that version's roadmap section. Anything else is scope creep and fails the gate. The first shipped entry of a track lists every ID that passed at that commit, from every section of that track (H0 rule 9, D-40).
4. Node and Spring have separate entries (`node 0.3.0`, `spring 0.1.0`).
5. Entries are written in a separate `history(<track>): <version>` commit after the release, never inside a build run.
6. Entries are never edited or deleted.

Entry format:

```
## <track> <x.y.z> — <YYYY-MM-DD> — <shipped|failed>
- Package: <name>@<x.y.z>
- Commit: <sha>
- Features: <ID, ID, ...>
- Stranger check: <pass|FAIL> (<time>)
```

The first shipped entry of a track uses the same format. Its `Features` line lists every passing ID, grouped by the roadmap section they came from:

```
## node 0.1.0 — <YYYY-MM-DD> — shipped
- Package: apiversa@0.1.0
- Commit: <sha>
- Features: node 0.1.0: CORE-01, CORE-02; node 0.2.0: CORE-08, CORE-10
- Stranger check: pass (<time>)
```

The guard reads the ID tokens. The section labels are for the reader. Later entries list only that version's IDs, with no section labels.

<!-- entries: newest first -->
