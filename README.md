# PrepWise

A placement-preparation platform for engineering students: aptitude and core-subject practice, resume analysis, skill-gap roadmaps and study plans, mock interviews, and coding practice. It runs entirely on free tiers, never sleeps, and works **without AI**. An optional AI assistant exists but is off by default.

Live: https://prepwise-api.prepwise-api.workers.dev

## What it does

| Area | How it works (no AI unless stated) |
|---|---|
| Auth, profile, onboarding | Email and password, httpOnly session cookie, login lockout, log out of all devices |
| Aptitude, technical and DSA practice | 210 curated multiple-choice questions, graded on the server, progress and weak areas |
| Companies | Company profiles and preparation material |
| Resume analyzer | PDF/DOCX read in the browser; skills, sections, impact and ATS checks; JD matching; 100-point score |
| Skill gap, roadmap, study plan, projects | 9 role profiles, 62 learning topics, 28 projects; deterministic, explainable output |
| Mock interview | 71 technical and 16 HR questions, concept-coverage scoring, adaptive difficulty, reports |
| Coding practice | 27 problems with 205 tests; JavaScript and Python run in your browser |
| AI assistant (optional) | Gemini, Groq, OpenRouter with fallback, image input; off by default |

## Architecture

```
Browser (React 19, Vite, Tailwind)  ──same origin──>  Cloudflare Worker (Hono)  ──>  D1 (SQLite)
  runs: resume parsing, code judge                      serves the static app and /api/*
  (Web Workers, Pyodide)                                 (optional) calls AI providers
```

- One Worker serves the built web app (static assets) and the API on one origin, so cookies are first-party and there is no CORS.
- Anything heavy runs in the browser (PDF parsing, NLP, code execution) because the Workers Free plan allows only **10 ms of CPU per request**. A worst-case check (`scripts/stress-*.mjs`) runs against production.
- TypeScript monorepo (npm workspaces):

```
apps/api        Hono Worker, D1 schema (Drizzle) and migrations, routes
apps/web        React app (JSX pages), Web Workers for the code runners
packages/content  Hand-written content: questions, roles, topics, projects, interview bank, coding problems
packages/core     Pure logic with tests: analytics, resume, learning, interview, coding judge, AI chain
packages/shared   zod schemas shared by API and web
scripts/        Smoke tests, stress tests, content authoring and verification tools
docs/           One page per iteration (what was built, how it was verified, known limits), demo script
```

## Run it locally

Prerequisites: Node 22+, a free Cloudflare account only if you want to deploy.

```powershell
npm install
copy apps\api\.dev.vars.example apps\api\.dev.vars        # then put your own random secrets in it
cd apps\api
npx wrangler d1 migrations apply prepwise-db --local
npx wrangler dev --local                                  # API and built app on http://localhost:8787
```

In another terminal: `npm run build -w @prepwise/web` once (the Worker serves `apps/web/dist`), or `npm run dev:web` for hot reload on http://localhost:5173 (it proxies `/api` to 8787; keep `ALLOWED_ORIGINS` as in the example).

## Test

```powershell
npm test                                  # unit tests (core, content, API helpers)
npx tsc -p apps/api --noEmit              # type check
node scripts/smoke.mjs http://localhost:8787            # also: smoke-practice, smoke-resume, smoke-learning,
                                                        # smoke-interview, smoke-coding, smoke-security, smoke-ai
```

Content tools: `node scripts/author-coding-problems.mjs` (regenerates and cross-verifies the coding bank with Python), `node scripts/check-links.mjs` (checks every learning resource link), `node scripts/check-ai-providers.mjs` (checks your AI keys and model names).

## Deploy (free)

1. `npx wrangler login`, create the database once: `npx wrangler d1 create prepwise-db`, and put its id in `apps/api/wrangler.toml`.
2. Set secrets (random values, never commit them): `npx wrangler secret put JWT_SECRET` and `npx wrangler secret put PASSWORD_PEPPER` in `apps/api`.
3. `npm run build -w @prepwise/web`, then from `apps/api`: `npx wrangler d1 migrations apply prepwise-db --remote` and `npx wrangler deploy`.
4. CI (`.github/workflows/ci.yml`) runs the tests and a local smoke run on every push, and deploys from `main` when the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist. Until you add them the deploy job fails; the test job does not depend on them.

## Free-tier limits that shaped the design (Cloudflare Workers Free)

- 10 ms CPU per request, 100,000 requests per day, 100,000 D1 writes per day.
- PBKDF2 is capped at 100,000 iterations in Workers, so passwords use HMAC with a server-side pepper plus PBKDF2 at that cap.
- Limits change; confirm them on Cloudflare's pricing pages before relying on this at scale.

## Optional AI assistant

Off by default. See [docs/ITERATION-7.md](docs/ITERATION-7.md) for how to enable it with your own provider keys (stored as Worker secrets) and how to verify model names.

## Security notes

- httpOnly, SameSite=Lax session cookie with 7-day expiry; `Origin` check on state-changing requests.
- Five failed logins lock an account for 15 minutes. "Log out of all devices" and changing the password end every other session at once.
- Response headers: `nosniff`, no-store on API responses, frame blocking, HSTS, and a Content-Security-Policy on the app pages (not on `/assets/*`, see `apps/web/public/_headers` for why).
- Code you write in Coding Practice runs in a Web Worker on your own device. The server cannot verify that a result is genuine, so coding progress is for practice only.
- Passwords are never logged; AI keys are Worker secrets and never reach the browser.

## Known limits

See each iteration page for details. The main ones: content (questions, key ideas, role requirements, study hours) was drafted by the author and needs review by someone who teaches the subject; interview scoring checks which ideas are mentioned, not whether they are correct; only 9 roles; coding supports JavaScript and Python with function-style problems only; the AI assistant has not been tested with real provider keys.

## Iterations

[0 scaffold and spikes](docs/ITERATION-0.md) · [1 auth and onboarding](docs/ITERATION-1.md) · [2 practice and progress](docs/ITERATION-2.md) · [3 resume analyzer](docs/ITERATION-3.md) · [4 skill gap, roadmap, plan, projects](docs/ITERATION-4.md) · [5 mock interview](docs/ITERATION-5.md) · [6 coding practice](docs/ITERATION-6.md) · [7 optional AI assistant](docs/ITERATION-7.md) · [8 hardening](docs/ITERATION-8.md) · [demo script](docs/DEMO.md)
