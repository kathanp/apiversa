# Open questions

The agent adds a question here when it cannot decide and the choice would change public behavior. Each one gets an `ASSUMED` decision in `docs/DECISIONS.md` so work can continue.

## Open

- **Q-1 — `cursor-agent` flags.** The scheduler calls `cursor-agent -p "<prompt>"`. The flag that lets it run shell commands without asking may differ by version (`--force` in some). Not verified. Check `cursor-agent --help` and set `APIVERSA_AGENT_ARGS`.
- **Q-2 — Market evidence.** The need is real but narrow (mobile apps, public partner APIs). No user has asked for this library yet. Before node 0.3.0, collect at least 5 issues or conversations from teams that would use it, and link them as `issue:` evidence. Overridden by D-26, D-34, D-36. Still 0 external issues.
- **Q-3 — Default policy.** `oldest` (D-3) is safe, but new clients that forget the header get the oldest shape. Stripe pins an account to the version current at signup. `pin-on-first-call` copies that but needs a pin store. Revisit after first users.
- **Q-4 — Maven snapshots.** Daily Spring snapshots need SNAPSHOT publishing enabled for the namespace in the Central Portal. Not verified.
## Resolved

- **Q-5 — Next.js route handlers.** FW-05 uses a wrapper per route handler. The test is `node/packages/next/test/next.test.ts` (`upgrades a route handler and downgrades the response`).
- **Q-6 — First-release numbering.** Closed by D-40 and H0 rule 9. The first published version of a track lists every ID that passes at that commit.
- **Q-7 — Required human review.** Closed by D-42. `main` requires one review. `next` does not. The owner creates stable tags.
