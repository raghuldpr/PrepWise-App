# Iteration 0: scaffold and spike results

Measured on the developer laptop (Windows 11, Node 24). Not yet measured on Cloudflare.

## Spike A: password hashing (PBKDF2, WebCrypto) in a local Worker (`wrangler dev --local`)

| Iterations | Wall time per hash (3 runs) |
|---|---|
| 10,000 | 15-16 ms |
| 100,000 | 150-180 ms |
| 210,000 | 300-350 ms |
| 600,000 | 880-890 ms |

- Local `wrangler dev` does **not** enforce the 10 ms Free-plan CPU limit, and wall time is not Cloudflare CPU time. Whether native `deriveBits` counts against the limit is **unconfirmed** (no official statement found).
- Real answer needs a deploy to a Free account and a look at the CPU time in Workers logs.
- **Decision (de-risking):** derive the key **in the browser** (PBKDF2, high iterations, email as salt) and have the server store only a cheap HMAC/SHA-256 of that derived key plus a server pepper. This works regardless of the CPU limit. Revisit if the deployed test shows server-side PBKDF2 fits.

## Spike B: PDF text extraction (`pdfjs-dist` 5.7, spikes/pdf-spike.mjs)

| Sample | Result |
|---|---|
| Single column | 4/4 headings, email found, 12 lines in 199 ms (includes warm-up) |
| No-heading-style resume (caps headings) | Headings found, email found, 8 ms |
| **Two column** | Columns merged into the same lines, only 1 of 3 headings found, email missed |

- Extraction is fast. Text position data is available.
- **The parser needs column detection** (cluster text items by x-position before building lines). This is the main resume-parser risk. Test with real student resumes later.

## Spike C: Python in a Web Worker (Pyodide 0.26.4 from the jsDelivr CDN)

- Correct solution: 2/2 tests pass, **75 ms** to run. Wrong solution: 2/2 fail correctly.
- Infinite loop: worker is terminated by a timeout, the page stays responsive.
- **First load 44.5 s** on a cold cache here, **about 5 s** when cached. Plan: show a loader, prefetch after login, host Pyodide with the app, and keep JavaScript as the default (instant) language.

## Cloudflare deploy results (prepwise-api, account assumed to be on the Free plan: verify in the dashboard)

- Worker deployed: https://prepwise-api.prepwise-api.workers.dev (health and spike routes only).
- D1 `prepwise-db` created (region APAC), bound as `DB`. Round trip `SELECT 1`: 12 ms.
- **PBKDF2 on the deployed Worker:**
  - **Hard runtime cap: 100,000 iterations.** 210k and 600k fail with "iteration counts above 100000 are not supported". This is a runtime limit, not CPU.
  - At 100k: **40 of 40** calls succeeded. Each call did a hash plus a verify (200k iterations of work). No CPU-limit errors. Round trip p50 122 ms, p95 198 ms, max 517 ms (includes network from this laptop).
  - `performance.now()` returns 0 inside Workers (timers are frozen), so in-Worker timing is meaningless. Use round-trip time or Workers logs.
- **Decision:** server-side PBKDF2-SHA256 at **100,000** iterations with a per-user random salt plus a server-side pepper secret. OWASP guidance is higher (600k), which Workers can't do natively. If we want more, add a browser-side PBKDF2 pre-hash and have the server hash that again.
- Caveat: the 40-call test was sequential and light. Re-check if sign-ups ever become bursty.

## Open items

- CI workflow is written (`.github/workflows/ci.yml`) but there is no GitHub remote yet, and deploys need the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Wrangler registered a `workers.dev` subdomain for the account during deploy (`prepwise-api`). It can be renamed in the dashboard.
- The spike routes (`/api/spike/*`) are public and must be removed in Iteration 1.
- No commit was made.
