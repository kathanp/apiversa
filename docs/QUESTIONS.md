# Open questions

The agent adds a question here when it cannot decide and the choice would change public behavior. Each one gets an `ASSUMED` decision in `docs/DECISIONS.md` so work can continue.

## Open

- **Q-1 — `cursor-agent` flags.** The scheduler calls `cursor-agent -p "<prompt>"`. The flag that lets it run shell commands without asking may differ by version (`--force` in some). Not verified. Check `cursor-agent --help` and set `APIVERSA_AGENT_ARGS`.
- **Q-2 — Market evidence.** The need is real but narrow (mobile apps, public partner APIs). No user has asked for this library yet. Before node 0.3.0, collect at least 5 issues or conversations from teams that would use it, and link them as `issue:` evidence.
- **Q-3 — Default policy.** `oldest` (D-3) is safe, but new clients that forget the header get the oldest shape. Stripe pins an account to the version current at signup. `pin-on-first-call` copies that but needs a pin store. Revisit after first users.
- **Q-4 — Maven snapshots.** Daily Spring snapshots need SNAPSHOT publishing enabled for the namespace in the Central Portal. Not verified.
- **Q-5 — Next.js route handlers.** Body conversion in App Router handlers may need a wrapper per handler rather than middleware. Verify before FW-05.

## Resolved

(none yet)
