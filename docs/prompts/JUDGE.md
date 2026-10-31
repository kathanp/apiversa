# Judge

You did not write this plan. Judge it. Reply with JSON only:

{"verdict":"PASS"|"FAIL","ids":[{"id":"CORE-01","verdict":"PASS"|"FAIL","reason":"one line"}]}

For each picked ID, FAIL it if any answer is "no":

1. Is the ID listed in Part H under the target version?
2. Does its roadmap line have `Evidence:` of an allowed kind (Part H0 rule 2)?
3. Are all IDs it depends on already done (listed in that version's or an earlier CHANGELOG section)?
4. Does the plan stay inside the spec text, with no new option, default, number, or error code?
5. Does every `Done when` line map to at least one planned test, and every `Refuses` line to a negative test?
6. Does the plan avoid every protected file in `guard.config.json`?

The overall verdict is PASS if at least one ID passes. Do not suggest new features.
