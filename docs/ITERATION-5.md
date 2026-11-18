# Iteration 5: mock interview (no AI)

Live: https://prepwise-api.prepwise-api.workers.dev/interview/setup/role (history at `/interview/history`)

The old mock interview asked an LLM to write questions, grade answers and write the report, and showed made-up scores when it failed. It is now a curated question bank with rule-based scoring. Same answer, same score, and every point is explainable.

## Question bank (`packages/content/src/interview-bank.ts`, hand-written, tested)

- **71 technical questions:** OOP, data structures, algorithms, DBMS and SQL, operating systems, networks, web and REST, JavaScript, React, Java and Spring, Python, Git, system design, testing, Docker. Easy, medium and hard.
- **16 HR and behavioural questions:** self-introduction, strengths, weaknesses, teamwork, conflict, failure, leadership, pressure, feedback, ethics, motivation, flexibility.
- Each question lists the **key ideas** a good answer contains (words and stems that show the idea), a model answer, and a tip. HR questions list what a strong answer must include.
- Tests: ids are unique, skills exist in the taxonomy, **every technical model answer scores "strong" under the engine** (this caught 12 mistyped term lists), four realistic HR answers score at least 60, and a polished story for the wrong HR question scores under 60.

## Engine (`packages/core/src/interview`)

- **Technical score:** share of key ideas covered (82%), answer depth (12%), whether it gives an example (6%). A word matches if a word in the answer starts with it, so "encapsulat" matches "encapsulation". Hyphens, slashes and case are ignored.
- **Anti-stuffing:** an answer earns credit for about one idea per five words, so a list of keywords cannot score well.
- **HR score:** key-idea coverage multiplied by form (length, "I" versus "we", numbers and examples). Form only scales relevance, so a good story that answers another question does not score.
- **Adaptive selection:** the question for each position is a pure function of the stored answers, so a refresh never changes it. Two strong answers in a row raise difficulty, two weak ones lower it. Preference goes to the target role's skills and your declared skills, to topics not yet asked, and to a per-interview shuffle (seeded by the interview id).
- **Report:** overall, technical, behavioural and communication scores, topic breakdown, strengths, improvements, links to what to revise (the learning topic and its hours from Iteration 4), and per question: your answer, ideas covered and missed, notes, model answer, tip.

## API (all behind the session cookie)

`GET /api/interviews/options`, `POST /api/interviews` (type TECHNICAL, HR or MIXED; difficulty; 3 to 10 questions), `GET /api/interviews/history`, `GET /api/interviews/:id`, `POST /api/interviews/:id/answer`, `POST /api/interviews/:id/complete`, `GET /api/interviews/:id/report`, `DELETE /api/interviews/:id`. The question shown never includes the ideas or model answer; the score is hidden until the report. Migration `0007_interviews.sql` adds one table. The newest 50 interviews per user are kept. `/api/users/analytics` now reports real counts and averages.

## Web

Setup is one page (type, role, difficulty, length). The session page has a timer, word count, optional dictation and read-aloud (browser speech APIs, nothing sent anywhere), skip and end with confirmation, and resumes after a refresh. The report page and history page (average, best, trend after four interviews) use real data. The old coding-interview page was removed; coding rounds return with Iteration 6.

## Verified

- 107 unit tests (23 new).
- `scripts/smoke-interview.mjs`: 50 checks (validation, no leaks, stable questions, 409 on a wrong question, isolation between two users, early end, mixed 10-question round, history, analytics, delete) pass locally and on the live site. The other four smoke suites pass on the live site.
- `scripts/stress-interview.mjs` on the **Workers Free plan**: 108 requests with 4000-character answers and 10-question interviews: 108 ok, 0 failed, median round trip 204 ms.
- Browser (local): setup, answering through the UI, and the report with real scores; the first live run after the deploy showed 4 failures from one generic 404 and three later runs were clean (an old version probably served that request while the new one rolled out; not proven).
- Test accounts and data were removed from production.

## Found by reading the output, then fixed

- Hyphenated terms ("first-in", "non-blocking") and slashes ("open/closed") never matched; both sides are now normalised.
- A concept label containing `=` (`==`) broke the term parser.
- The keyword-stuffing limit was too strict for short correct answers.
- An HR story answering the wrong question scored 63 to 69; relevance now gates form, and each HR question's distinguishing idea counts double.
- The report praised "full answers" for off-topic text.

## Known limits

- **The score is not understanding.** It checks which ideas are mentioned. A wrong sentence using the right words can score well, and a correct answer in unusual words can score low. The report says so.
- Only 87 questions in total, so repeat users will see repeats across interviews (not within one). Company-specific questions do not exist; the company field is only a label.
- The 16 HR questions limit very long HR rounds: 10 HR questions is the practical maximum.
- Answers are stored as plain text on the server (up to 4000 characters each) and deleted with the interview.
- Browser dictation depends on the browser (Chrome and Edge work; Firefox does not).
- Key ideas and model answers were drafted by me and have not been reviewed by a teacher; read through `interview-bank.ts` before relying on them.
