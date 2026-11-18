# Iteration 8: hardening, tests, docs and demo

## Security

- **Login lockout:** 5 failed passwords lock the account for 15 minutes (HTTP 429 with the minutes left). The check runs before the password work, so a locked account costs no CPU. A successful login resets the counter. Unknown emails still get the same generic 401 and the dummy hash, so the lock does not reveal which emails exist beyond the account owner's own lock message.
- **Real "log out of all devices":** each user has a `session_version` stored in the cookie's token. `POST /api/auth/logout-all` increments it, which invalidates every issued cookie at once; changing the password does the same but keeps the current device signed in. This costs one indexed read per authenticated request. Deactivating a user now also ends their sessions immediately. Cookies issued before this change carry no version and are treated as version 1, so nobody was logged out by the upgrade.
- **Headers:** API responses send `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. The static app sends frame blocking, nosniff, referrer policy, HSTS, a microphone-only permissions policy (dictation) and a Content-Security-Policy on the HTML pages (`apps/web/public/_headers`).
- **CSP trade-off, found by testing:** the JavaScript runner evaluates the student's code with `new Function` inside a worker, and a worker follows the policy of its own script, so the policy is deliberately not set on `/assets/*`. The first attempt (a blanket policy) broke JavaScript coding practice with "'unsafe-eval' is not allowed", and Vite's `?worker` import hid the real cause because it starts workers from a blob that inherits the page's policy. Workers are now started from their own files. The page policy still restricts where scripts, workers, connections, images and fonts may come from. New top-level routes need adding to the list in `_headers` (a missed route simply has no CSP).
- Migration `0010_security.sql` adds three columns to `users`.

## Wording and dead code

Removed leftover "AI" claims from the landing page, aptitude screens, hub header, settings, profile, results page and page titles; deleted the unused AI error helper. The AI assistant page only appears as active when the owner enables it.

## Documentation and delivery

- `README.md`: what it does, architecture, running locally, testing, deploying, free-tier limits, security notes, known limits, links to every iteration page.
- `docs/DEMO.md`: a 10-minute script with fallbacks and likely questions.
- `apps/api/.dev.vars.example`.
- **CI** now type-checks the API and core packages, runs all unit tests, builds the web app, starts the Worker locally with a throwaway database and random secrets, and runs all eight smoke suites against it before the deploy job. The deploy job applies migrations before deploying. It still needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (not added yet).

## Verified

- `scripts/smoke-security.mjs` (20 checks): lockout after 5 failures, locked account refuses the right password, other accounts unaffected, counter resets on success, logout-all signs out a second device at once, password change signs out other devices but not this one, forged cookie refused, header checks. All eight smoke suites pass locally with the new session check and on the live site.
- Browser with the CSP on: JavaScript and Python coding, an infinite loop stopped, no CSP violations, fonts loaded, the AI image preview worked.
- Unit tests: 127 pass; type checks pass for API and core.

## Not verified or still open

- **GitHub Actions results were never checked** (`gh` is not installed here, and the workflow cannot run until the repository is pushed). The commands it runs were run locally one by one.
- The deploy secrets are not set. After you add them, the first push to `main` will deploy.
- Lockout is per account, not per IP: an attacker can lock a known account for 15 minutes at a time (a nuisance, not a break-in). Rate limiting by IP would need another store.
- The CSP allows inline styles (Tailwind and the fonts stylesheet need them).
- Content (questions, interview key ideas, role requirements, study hours, coding statements) has not been reviewed by a teacher.
- Still not tested with real AI keys (see Iteration 7).
