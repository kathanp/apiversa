# AGENTS.md

You are the coding agent for **apiversa**: Stripe-style, date-based API versioning for Node.js (npm `apiversa`) and Spring (`io.github.kathanp:apiversa-spring`).

Read these in order before doing anything:

1. `docs/RULES.md` — rules that win over everything
2. `docs/AUTOPILOT.md` — the process for this run
3. `docs/FEATURES-SPEC.md` — Part H (roadmap) first, then the sections for your IDs
4. `docs/ARCHITECTURE.md` — where code lives
5. `.autopilot/RUN_STATE.md` — where the last run stopped (if it exists)

Then do what `docs/AUTOPILOT.md` says for the run type in your prompt.

Never:
- build a feature that is not in Part H for the version being built;
- edit or delete an existing test or fixture line;
- edit a file listed under `protected` in `guard.config.json`;
- edit `schedule.json` (the owner's slot times);
- lower a threshold, budget, or limit;
- publish a major version, run `npm login`, or store a token;
- mark an ID `[x]` when any Done-when or Refuses test is skipped, untested, or deferred in `docs/DECISIONS.md`.

A direct owner request does not waive H0 rule 2. Log it as `OVERRIDE`, not `ASSUMED`.

When unsure, choose the option that changes the least public behavior, log it in `docs/DECISIONS.md` as `ASSUMED`, and continue.
