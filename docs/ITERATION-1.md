# Iteration 1: auth, profile, onboarding on the new stack

Live: https://prepwise-api.prepwise-api.workers.dev (one Worker serves the React app and `/api`).

## Built

- **API (Hono + Drizzle + D1):** `POST /api/auth/{register,login,logout}`, `GET/PUT /api/users/profile`, `GET/PUT /api/users/settings`, `POST /api/users/change-password`, `GET /api/skills`, `POST /api/onboarding/{skills,goals}`. Same paths and response shapes as the old Spring backend, errors as `{status,error,message}`.
- **DB:** migrations `0000_init` (users, profiles, skills, user_skills) and `0001_seed_skills` (27 skills from the old seed). Applied locally and to the remote D1.
- **Auth:** httpOnly, SameSite=Lax, Secure (on https) session cookie holding a 7-day HS256 JWT. No token in JavaScript or localStorage. Passwords: HMAC pepper + PBKDF2-SHA256, 100,000 iterations (the Workers cap), per-user salt. Login runs a dummy hash for unknown emails and returns one generic message. Origin check blocks cross-origin writes.
- **Web:** old React app moved to `apps/web` (the stale `frontend/` copy is not carried over). `AuthContext` now asks the server who you are (cookie), `api.js` uses `withCredentials`, logout calls the API. Password minimum raised to 8 in the UI to match the API. `lucide-react` pinned to 0.546.0 (newer versions removed the brand icons the pages use).
- **Spike routes removed.**

## Verified

- `scripts/smoke.mjs`: 24 checks, all pass locally and on the deployed URL (two clean runs).
- 4 unit tests (password hashing), API typecheck, web build.
- Browser: `/register` stays on the register page, registering lands on onboarding and the skill list loads from D1.
- The first smoke run right after a deploy had 4 failures that did not repeat in two later runs. Most likely the old version was still serving for a few seconds; this is an inference, not proven.

## Not done / known gaps

- Pages for later iterations (dashboard data, placement, interview, career hub) are copied but their API routes do not exist yet, so they show errors until Iterations 2 to 6.
- `GET /api/users/analytics` (Profile page) arrives with Iteration 2.
- "Log out of all devices" ends this device's session only (stateless cookies).
- No login rate limiting yet.
- The onboarding screens were checked by API test, and only partly by clicking in the browser pane.
- Nothing is committed. GitHub remote and repo secrets are still needed for the CI deploy.
