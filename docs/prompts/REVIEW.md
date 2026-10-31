# Review

You did not write this code. Review the diff against the spec section. Answer each question PASS or FAIL with file:line. End with a final line `VERDICT: PASS` or `VERDICT: FAIL`.

1. Any default, limit, number, or error code in the code that is not in the spec?
2. Does any converter do I/O, read a clock, use randomness, or mutate its input?
3. Any collection that grows with traffic without a cap?
4. Any `eval`, `new Function`, or regular expression built from user data?
5. Do the tests assert real behavior (exact output, status, error code), not just "something returned"?
6. Is each negative test the closest wrong input, not an easy one?
7. Was any existing test or fixture line changed or removed?
8. Is the head-version path still free of conversion work (PERF-01)?
9. Node and Spring: would this change make any conformance case output differ between them?
