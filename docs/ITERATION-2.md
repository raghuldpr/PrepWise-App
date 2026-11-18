# Iteration 2: question bank, practice, progress, companies

Live: https://prepwise-api.prepwise-api.workers.dev

## Content: the real size of the old question bank

The old project's two seed files looked like 206 questions. **They are 133.** `questions_batch2.sql` re-inserts 73 questions that are already in `questions_seed.sql` (same ids, same text), and because the option inserts had no uniqueness rule, the old database would have attached the options twice to those questions. This was cleaned during import:

| Module | Questions | Notes |
|---|---|---|
| Aptitude | 39 | 37 quantitative, **only 2 logical/verbal** |
| Technical | 59 | OS 23, DBMS 25, Networks 11, **OOP 0** |
| DSA | 35 | multiple-choice concept questions only |
| Coding | 0 | no runnable problems yet (Iteration 6) |
| HR | 0 | no questions yet (Iteration 5) |

All are MCQ with 4 options, one correct answer and an explanation. Content is now in `packages/content/src/{questions,companies}.json`; `scripts/build-seed.mjs` generates migration `0003_seed_questions.sql` from it. `packages/content/src/questions.test.ts` checks the bank (unique ids and text, valid enums, exactly one correct option, correct answer matches `expectedAnswer`).

**Content gap to close:** logical/verbal reasoning, OOP, HR, behavioral and coding problems need new questions (drafted once with AI at build time and reviewed by you).

## API (all behind the session cookie)

- `GET /api/questions` (filters: `categoryId`, `moduleType`, `difficulty`, `companyId`, `questionType`, paging, sort), `GET /api/questions/:id`, `GET /api/questions/categories`. Same Page shape as the old backend. Default order puts questions you have not tried first.
- **Answers never leak:** lists hide `expectedAnswer`, `explanation` and option correctness. `?includeAnswers=true` is ignored for MCQs until the user has attempted that question (the old API handed answers to anyone).
- `POST /api/attempts`: **graded on the server.** `isCorrect` and `score` sent by the client are ignored. Answers are matched by option id or text. Anything that is not a listed option returns 400. Non-MCQ answers are stored but marked ungraded and excluded from progress.
- `GET /api/attempts/recent`, `GET /api/progress`, `/api/progress/weak-areas?threshold=`, `/api/progress/:categoryId`, `GET /api/companies`, `/api/companies/:id/preparation`, `GET /api/users/analytics`.
- Progress is recomputed with one atomic SQL upsert per graded attempt. It counts every attempt (re-answering the same question counts again, as in the old backend).
- Analytics fixes over the old backend: real streak (consecutive days; the old "streak" was the number of distinct active dates), no invented strong/weak topics for new users, module progress = share of the module's questions answered correctly at least once. Logic is pure code in `packages/core/src/analytics.ts` with tests.

## Web changes

- **Progress page** now reads `/users/analytics`. The old page expected a response shape the API never returned, so it always silently showed hard-coded numbers (74% accuracy, 128 attempts, 6-day streak). Fixed.
- **Aptitude and Technical**: removed the hard-coded fallback questions and the in-browser "fallback grading" (it could show a result without the server). Failures now show an error.
- **Companies and company detail** rewritten on real data: description, industry, tagged-question counts per module, and the list of tagged question titles. The old page showed Google's interview rounds and salaries for every company. Rounds, salary and tips are marked as not included yet.
- `scripts/patch-iteration2-web.mjs` is the one-off codemod used for the page edits (kept for the record).

## Verified

- `scripts/smoke-practice.mjs` (30 checks) passes locally and on the live site (3 clean runs); `scripts/smoke.mjs` (24 checks) still passes.
- 18 unit tests (password, analytics, question bank). API typecheck and web build pass.
- Browser (local): Aptitude shows real questions and grades a submitted answer (session accuracy updated), Progress shows 1 attempt / 100% / 1-day streak, Profile analytics are real, Company page shows Google's 24 tagged questions, Dashboard loads.
- Right after the deploy, one practice run reported 5 failures that did not reappear in four later runs. Same pattern as Iteration 1 (most likely requests served by the previous version during rollout; inference, not proof).
- Test accounts removed from production; the production database holds only seed data.

## Not done / known gaps

- **DSA and Coding pages** still use their hard-coded fallback problem lists and local "PASSED" results. They are replaced in Iteration 6 (real code execution). The 35 DSA concept MCQs are not yet reachable from a working screen.
- **Dashboard copy** still talks about "AI audit" and "AI interview"; its "Target role" reads a default instead of the profile value. To fix with Iterations 3 and 5.
- The practice screen text "immediate AI feedback" is stale (feedback is the stored explanation).
- Free-text and coding answers are not graded yet.
- No login rate limiting; nothing about company interview rounds or salaries.

## Addendum: question batch 1 (77 new questions, migration 0004)

Drafted with AI at build time by `scripts/author-extra-questions.mjs`; **the content still needs a human read-through** (see below). Numeric answers (series, directions, ranking, seating) are computed or brute-forced in that script, and the structure is checked by `questions.test.ts`.

| Category | Before | Added | Now |
|---|---|---|---|
| Logical & Verbal Reasoning | 2 | 31 | 33 |
| Object-Oriented Programming | 0 | 32 | 32 |
| Computer Networks | 11 | 14 | 25 |

Total 210 questions, 840 options, one correct each. Aptitude is now 70 (37 quantitative + 33 reasoning), Technical 105, DSA 35. New questions are not tagged to companies (the old tags were arbitrary, and I did not want to invent "asked at Google" claims).

Reviewer notes:
- Two questions touch language/standard changes: Java constructor rules (kept to rules that do not depend on the newest Java release) and HTTP idempotency (per RFC 9110).
- Still missing: coding problems (Iteration 6), HR/behavioral questions (Iteration 5), more DSA and DBMS/SQL, and quantitative aptitude beyond 37.
- Content workflow: edit the batch script or JSON, then `node scripts/build-seed.mjs`. Never edit an applied migration; add a new batch file and a new `EXTRA` entry for the next set.
