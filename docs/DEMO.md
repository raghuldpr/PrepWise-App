# PrepWise demo script (about 10 minutes)

Use a fresh account (any email, for example `demo@example.com`). Open https://prepwise-api.prepwise-api.workers.dev in a normal window. Have a sample resume PDF ready (`spikes/samples/asha-resume.pdf` works).

**Opening line (20 s):** "PrepWise helps students prepare for campus placements. It runs on free hosting, it never sleeps, and almost nothing in it uses AI: the features are rules and curated content, so the results are explainable."

| # | Show | Do | Say |
|---|---|---|---|
| 1 | Register and onboarding (1 min) | Register, pick 5 to 6 skills with levels, set target role "Backend Developer" | "Your skills and role drive everything after this." |
| 2 | Resume Analyzer (1.5 min) | Hub, Resume, upload the PDF, choose Backend Developer, open the result | "The PDF is read in your browser; the file is never uploaded. The score is 100 points in six parts and every deduction is explained." Point at found skills, missing skills and the fixes list. Paste a short job description to show the match. |
| 3 | Skill gap, roadmap, study plan (2 min) | Skill Gap (now includes resume skills), Create roadmap, Make a study plan for 8 weeks at 10 hours | "It uses a prerequisite graph, so it never tells you to learn Spring before Java." Show the plan's note: if the time does not fit, it says what was left out and what would fit. Tick a few tasks. |
| 4 | Practice (1 min) | Placement, Aptitude, answer two questions, open Progress | "Answers are graded on the server. Progress and weak areas come from real attempts." |
| 5 | Mock interview (2 min) | Interview, Mixed round, 3 questions, answer one well in your own words and one badly, finish, open the report | "No AI: each question lists the key ideas a good answer contains, and the report shows which you covered and missed, with the model answer. Two strong answers in a row make the next question harder." Point at the honesty note about what the score can and cannot tell. |
| 6 | Coding practice (2 min) | Coding, open Two Sum, write a wrong answer and Submit (shows the failing test), then the right one; switch to Python once | "Code runs in a Web Worker on your device. An infinite loop is stopped after 2 seconds. Python loads once from a CDN, about 7 seconds." |
| 7 | Optional AI assistant (30 s) | Hub, AI Assistant | "Off by default. If the owner adds a key, it tries Gemini, then Groq, then OpenRouter, and accepts screenshots. Nothing else depends on it." |
| 8 | Close (30 s) | Settings, Log out of all devices | "Five wrong passwords lock the account for 15 minutes, and this button ends every session on every device." |

## If something goes wrong

- **Python is slow or fails to load:** switch back to JavaScript; say it needs internet on first use.
- **Resume PDF text looks odd:** use the `.docx` sample (`spikes/samples/meera.docx`) or paste text from the sample.
- **Login says too many attempts:** wait 15 minutes or register a new demo account.
- **Site feels slow right after a deployment:** retry once; a rollout can serve the old version for a few seconds.

## Questions you may be asked

- **"Where is the AI?"** Deliberately minimal. Rule-based features are free, instant, repeatable and explainable. The optional assistant is the only AI and is off unless configured.
- **"Can the code judge be cheated?"** Yes: it runs in the browser, so the server cannot verify a pass. It is for practice, not ranking.
- **"How accurate is interview scoring?"** It measures coverage of expected ideas and answer structure, not correctness; the report says so and shows the model answer.
- **"What does it cost?"** Nothing on the free tiers used (Cloudflare Workers and D1). Limits are in the README.
