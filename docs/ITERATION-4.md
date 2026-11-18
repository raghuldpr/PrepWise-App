# Iteration 4: skill gap, roadmap, study plan, projects (no AI)

Live: https://prepwise-api.prepwise-api.workers.dev/hub/skill-gap (also `/hub/roadmap`, `/hub/study-plan`, `/hub/projects`)

The old versions asked an LLM for free-form JSON from free-text inputs and fell back to canned data on failure. These are now deterministic: same inputs, same output, every number explainable.

## Content (`packages/content`, hand-written, tested)

| File | What |
|---|---|
| `topics.ts` | 62 learning topics: level, hours, the skills each teaches, prerequisites, outline, practice tasks and free resources. Dependency graph is tested for missing prerequisites, cycles and level ordering. |
| `projects.ts` | 28 portfolio projects (domain, difficulty, languages, roles, skills, features, four build phases, why it helps, extensions). |
| `roles.ts` (extended) | Stack presets (for example Java + Spring Boot, MERN) that resolve "any of" requirements; map from the 27 onboarding skills to the finer taxonomy. |
| Tests | Every role requirement is teachable by some topic; every project and topic references real skills and roles. |

`scripts/check-links.mjs` checks all 91 resource links. Result: 89 resolve, 2 block bots (linuxjourney.com, leetcode.com, both real sites), 0 dead. It found and fixed 3 dead links and about 20 moved ones before shipping. Re-run it every few months; links rot.

## Engines (`packages/core/learning`)

- **Evidence:** onboarding skills (BEGINNER 40%, INTERMEDIATE 70%, ADVANCED/EXPERT 100%) combined with skills from the latest resume analysis (shown in a project 80%, only listed 50%); the higher wins. 70% counts as covered.
- **Skill gap:** compares evidence with the role profile (core 3, important 2, useful 1). Statuses covered / improve / missing, a readiness percentage, and a learning order: foundation, then core, then advanced, respecting prerequisites and skipping what is already covered. An explicitly chosen stack is learned even if another option is already known.
- **Roadmap:** phases (Foundations, Core skills, Advanced, Portfolio projects, Placement preparation) built from the gap, projects ranked by the skills you lack, durations from your weekly hours.
- **Study plan:** fits the roadmap into the weeks and hours you choose. Weekly budget adds up to your hours (65% learning, 25% practice, 10% revision and mock). Daily tasks come from each topic's outline; practice tasks point back into this app (aptitude questions, Progress page, mock interviews, Resume Analyzer). If it does not fit it **says so**: required hours, weeks or hours per week that would fit, and exactly which items were left out (lowest priority and latest first, then leftover hours are refilled with the best items that still fit). Spare weeks become practice, project polish and revision.
- **Projects:** ranked by language, domain, difficulty, target role and missing skills; "full-stack required" is a hard filter. Each result lists why it was recommended.

## API (all behind the session cookie)

`POST /api/skills/analyze`, `GET /api/skills/gap-analysis`, `POST /api/roadmap/generate`, `GET /api/roadmap[/:id]`, `PUT /api/roadmap/:id/progress`, `DELETE /api/roadmap/:id`, the same set under `/api/study-plan`, and `POST /api/projects/recommend`, `GET /api/projects/{options,saved,:id}`, `POST /api/projects/:id/save`, `PUT /api/projects/:id/status`, `DELETE /api/projects/:id/save`. Progress (checked topics and tasks) is saved per user. The newest 20 roadmaps and 20 plans per user are kept. Old field names are kept where the old pages used them. Migration `0006_learning.sql` adds four tables (`skill_gap_analyses`, `learning_roadmaps`, `study_plans`, `user_projects`).

## Verified

- 84 unit tests (37 added in this iteration): evidence mapping, gap statuses, ordering, any-of handling, roadmap hours, plan budgets, trimming rules, task uniqueness, ranking.
- `scripts/smoke-learning.mjs`: 48 checks (including isolation between two users) pass locally and on the live site; the other three smoke suites still pass on the live site.
- **CPU check on the Workers Free plan:** `scripts/stress-learning.mjs` ran the 36 heaviest requests (all 9 roles, 26-week plans, 109 KB responses) against production: 36 of 36 succeeded, median round trip 216 ms. Worker startup is 37 ms.
- Browser (local): the four pages load with real data. The skill gap picked up the profile's target role and the skills from a resume analysed earlier; a roadmap and a plan generated and saved progress; the project finder ranked with reasons and saved a project.
- Test accounts and their data were removed from production.

## Bugs found by reading the output, then fixed

- A 12-week plan for a newcomer kept only Java fundamentals (trimming dropped the biggest items first) and repeated the same task four times a week. Trimming now keeps a coherent start of the roadmap in priority order, and sessions alternate between study and hands-on with unique labels.
- Weekly hours could exceed the budget (checkpoints, mock interviews and the final week were not counted). Now bounded and tested.
- An 8-week plan used 5 weeks for one topic and wasted the rest; leftover hours are now refilled.
- A chosen stack was ignored when another option was already known.
- "Full-stack required" still returned backend-only projects.

## Known limits

- Hours per topic and role requirements are my estimates for a typical student; they are not measured. A newcomer's backend roadmap comes out at about 560 hours, so short deadlines will always trim.
- Only 9 roles and 7 stack presets exist; free-text roles are matched by keyword. A role outside the list falls back to Software Engineer.
- Resource links can rot (run `scripts/check-links.mjs`). Resources are links only; nothing is hosted or rated.
- Skill evidence comes from self-declared levels and the resume check, not from testing.
- Roadmap and plan pages use the stack presets, not every possible technology.
- Study plan assumes five study days plus a practice day; there is no calendar or reminders.
