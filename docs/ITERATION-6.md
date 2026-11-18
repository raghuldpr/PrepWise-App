# Iteration 6: coding practice with an in-browser runner (no AI, no server execution)

Live: https://prepwise-api.prepwise-api.workers.dev/placement/coding (DSA multiple-choice at `/placement/dsa`)

The old coding page showed hardcoded problems and a fake "PASSED" for every test. It now runs your code against real test cases, in your browser.

## How code runs

- **JavaScript:** a Web Worker (no DOM, no access to the page). Starts instantly.
- **Python:** Pyodide 0.26.4 (CPython compiled to WebAssembly) in a Web Worker, downloaded from the jsDelivr CDN on first use and cached by the browser. It took about 7 seconds in my test; the first load on a slow connection can be much longer (the Iteration 0 spike measured 44 s cold). The page shows a loader and starts loading as soon as you pick Python.
- **Limits:** 2 seconds per test in JavaScript, 4 in Python. A test that exceeds the limit gets its worker terminated, which is the only way to stop an infinite loop in a browser. The remaining tests are marked skipped. After a Python timeout the runtime reloads from cache (about 6 s).
- **Why not on the server:** the Workers Free plan allows 10 ms of CPU per request, so running user code there is not possible, and running it on a third-party judge would break the "no external cost" rule. Java and C++ are therefore not supported.
- Verdicts: Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded, Compile Error (rules in `packages/core/src/coding/judge.ts`, unit-tested). Output order can be ignored for problems where it should be (group anagrams, 3Sum, top-k). Console output is captured and shown.

## Problem bank

27 problems (13 easy, 12 medium, 2 hard) across arrays and hashing, strings, two pointers, sliding window, stacks, binary search, graphs, intervals and dynamic programming, with 205 tests in total. Each has a statement, constraints, two examples taken from its tests, hints you reveal one at a time, starter code in both languages, and a reference solution with its complexity.

Authoring is done by `scripts/author-coding-problems.mjs`, which **verifies the bank**: expected outputs come from the JavaScript solution, and an independent Python solution (run with the system Python) must produce the same output for every test, or nothing is written. It writes `coding-problems.json` (statements, starters, tests) and `coding-solutions.json` (reference solutions, read only by the API).

Unit tests (`packages/core/src/coding`): every JavaScript reference passes all of its tests; the starter code and a constant answer fail every problem; and plausible wrong solutions are caught. The last check found a real gap straight away: a greedy coin-change passed every test, so I added cases where greedy fails.

## Tracking and API

`GET /api/coding/status`, `POST /api/coding/submissions`, `GET /api/coding/submissions/:problemId`, `GET /api/coding/solution/:problemId`. The newest 10 submissions per problem are kept, and the latest accepted one is never pruned (the smoke test found my first version would un-solve a problem). The reference solution unlocks after you solve the problem or submit 3 attempts. The dashboard and Progress page now count coding problems tried and solved. Migration `0008_coding.sql` adds one table.

**Trust:** the judge runs in your browser, so the server cannot verify a result. It checks that a report is consistent (test count matches the problem, verdict matches the passed count) but a determined user could fake "Accepted". That only affects their own progress numbers, which is acceptable for practice, and nothing here should be used as a certificate or a ranking.

## Web

Problem list with progress by difficulty and filters; problem page with statement, examples, hints, editor (Tab key works, drafts saved per problem and language in your browser), Run examples, Submit, per-test results with input, expected and actual output, My submissions (load an old attempt) and Solution tabs. The DSA page now serves the 35 DSA multiple-choice questions that were unreachable before. Stale "AI" wording was removed from the technical practice screen.

## Verified

- 115 unit tests (8 new). `scripts/smoke-coding.mjs`: 31 checks (validation, solution gating, pruning, isolation, analytics) pass locally and on the live site; all five other smoke suites pass live.
- Browser, local and live: JavaScript and Python both tested with a correct solution, a wrong one, a syntax error, a runtime error, an infinite loop (stopped after 2 s and 4 s) and a missing function. Python kept working after a timeout.
- Test accounts were removed from production.

## Known limits

- JavaScript and Python only; function-style problems only (no input/output streams, no linked lists, trees or classes, so no LRU cache or tree problems).
- Python needs internet on first use (CDN) and a few seconds of loading.
- Timing is for finding loops, not for ranking performance; speed depends on the device. Tests are small (largest input about 400 elements), so an O(n^2) solution passes problems where O(n) is intended.
- The judge result is client-side and cannot be verified by the server (see Trust).
- Statements, hints and solutions were written by me and not reviewed by a teacher.
