# Iteration 7: optional multimodal AI assistant with provider fallback

Page: `/hub/ai-assistant`. **Off by default.** Everything else in PrepWise is rule-based and works without it.

## What it does

A chat for placement questions where the student can also attach an image (a screenshot of a question, code, an error or a resume section). The Worker calls up to three providers in order and uses the next one when one fails: **Gemini, Groq, OpenRouter**. All three expose an OpenAI-compatible `/chat/completions` endpoint, so one client handles them (`packages/core/src/ai/chain.ts`).

- **Fallback triggers:** rate limit (429), server error (5xx), rejected key (401/403), unknown model (404), rejected request (400, for example a model that cannot read images), timeout (20 s), network failure, empty or malformed reply. The first provider is tried again on the next message, so it is used again as soon as it recovers.
- **Images:** one per message, JPEG, PNG or WebP. The browser shrinks it (longest side 1024 px, re-encoded as JPEG under about 700 KB, which also removes photo metadata). The server checks the type, base64, size (1 MB) and file signature, so an SVG or script renamed to `.png` is refused. Images are sent to the provider and **never stored**; the conversation keeps only the text and a note that an image was attached.
- **Grounding (opt in):** a checkbox shares only the target role and skill names (from the skill gap engine). Nothing else about the student is sent. Off by default.
- **Limits:** 25 messages per user per day (setting `AI_DAILY_LIMIT`) and 5 per minute. A failed request (all providers down) is refunded. Limits protect your free provider quotas. The newest 30 conversations per user are kept, 60 messages each, and the last 10 turns are sent as context.
- **Privacy notice** on the page: messages and images go to an outside provider.
- **Prompt-injection stance:** the system prompt says text inside images and pasted material is data, not instructions; the model has no tools and no access to anything but the conversation, so the worst case is a wrong or off-topic answer.

## Turning it on (site owner)

Keys are Worker secrets, never in the repo or the browser. Do not paste them into chat.

```powershell
cd apps/api
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY          # optional
npx wrangler secret put OPENROUTER_API_KEY    # optional
```

Then set `AI_ENABLED = "true"` in `apps/api/wrangler.toml` and run `npx wrangler deploy`. A provider without a key is skipped. `AI_PROVIDERS` sets the order. `*_MODEL` and `*_BASE_URL` settings override the defaults.

**Model names change often and I could not test your keys.** The defaults (`gemini-3.8-flash`, `qwen/qwen3.8-27b`, `openrouter/free`) came from each provider's docs on the day I wrote this, and I did not verify that your accounts can use them or that they are free on your plan. Before enabling, run:

```powershell
$env:GEMINI_API_KEY="..."; $env:GROQ_API_KEY="..."; $env:OPENROUTER_API_KEY="..."; node scripts/check-ai-providers.mjs
```

It tests each provider with a text question and a small image and tells you which model names work. Keys stay in your shell and are not printed.

## Verified

- 127 unit tests (12 new): fallback order, every failure type, empty and malformed replies, timeout, image-capable providers only for images, keys and raw provider errors never appear in results, image signature checks including SVG disguised as PNG.
- `scripts/smoke-ai.mjs --mock` (30 checks) against a local Worker wired to `scripts/mock-ai-server.mjs`, a fake OpenAI-compatible provider whose behaviour can be switched at run time: Gemini rate limited, Groq failing, OpenRouter answering. It verifies the whole path including history, image, opt-in context, refunds, the all-providers-down 502, recovery of the first provider, per-minute limit, isolation between users and deletion.
- `scripts/smoke-ai.mjs` (without `--mock`) on the live site, where the assistant is off: status says so, chat is refused with 403, and the other six smoke suites pass.
- Browser (local, mock providers): the page loaded, an image was picked, shrunk and sent, the provider received it, and the reply showed which provider answered.

## Not verified

- **No real provider was called.** The request format follows each provider's docs (OpenAI-compatible, images as base64 data URLs), but real behaviour (model names, vision support, CORS-free server calls, free-tier limits, response shape quirks) is untested until you run the check script with your keys.
- Free quotas change; a provider can start answering 429 at any time, which is what the fallback is for.
- Replies are not streamed; a slow answer shows a spinner for up to 20 s per provider (worst case about a minute).
- Answers can be wrong. The page says so; nothing in PrepWise relies on them.

## When the AI cannot answer (added after the first live test)

If the student has used the daily allowance, a per-minute limit is hit, every provider fails or runs out of quota, or the connection drops, the assistant does not just show an error. It falls back to **search**: the browser finds the closest passages from PrepWise's own study material (Iteration 10) and shows them under a heading that says "search result, not AI", with the reason the AI was unavailable. Nothing is saved for these replies and no AI quota is used. Request problems such as an unreadable image still show an error and keep the text so it can be fixed.

Order of fallbacks for one message: the providers in `AI_PROVIDERS` order, then study search.

## Live test with real keys (first run)

| Provider | Result |
|---|---|
| Groq (`qwen/qwen3.8-27b`) | Text answered and cited a PrepWise source; an image question ("what colour is the square?") answered "Red" |
| Gemini (`gemini-3.8-flash`) | **Key rejected.** The most likely cause is a key of the wrong kind: Gemini's OpenAI-compatible endpoint needs a key from Google AI Studio (https://aistudio.google.com/apikey), not a Vertex AI key. Not working yet |
| OpenRouter (`google/gemma-4-31b-it:free`) | **Rate limited** at the time of the test (free models share a small quota). It may work later |

Groq is first in `AI_PROVIDERS`, so the assistant works today. With only Gemini enabled (a temporary test), the live page showed the study-search fallback correctly.

## Providers and free-quota protection (final set)

**Providers, in order:** Groq, Cloudflare Workers AI, OpenRouter. Gemini is no longer used (the code still supports it, but it is not in the default order and its key is not needed). Details from each provider's official documentation, read on 22 November 2026:

| Provider | Free allowance | Notes |
|---|---|---|
| Groq (`qwen/qwen3.8-27b`) | 30 requests a minute, 1,000 a day, but only **8,000 tokens a minute and 200,000 a day**, shared by the whole organisation (so by all students) | The token caps are what runs out, not the request counts. The page did not clearly label which plan its table described, so check your account's limits page |
| Cloudflare Workers AI | **10,000 Neurons a day**, free, on the Cloudflare account that hosts the app; no key. Past the allowance requests fail | Uses the `AI` binding in `wrangler.toml`. Text: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (about 75 Neurons for a typical reply, so about 130 replies a day). Images: `@cf/meta/llama-4-scout-17b-16e-instruct`. Some other models need a paid plan |
| OpenRouter (`google/gemma-4-31b-it:free`) | 20 requests a minute and **50 a day**; 1,000 a day after buying $10 of credit once | Small backup; it was rate limited when tested |

Not used: Cerebras (no renewing free tier: a one-time $5 credit that needs a card and expires after 30 days), GitHub Models (retired on 30 July 2026), Hugging Face (no free credits), Mistral (no free tier could be confirmed).

**What protects the quotas** (all in `apps/api/src/routes/ai.ts`, `packages/core/src/ai`):

- **Fewer tokens per message:** at most 2 reference passages (each cut to 600 characters), the last 4 messages of history, and replies capped at 450 tokens. Roughly a third of the tokens of the first version.
- **Circuit breaker:** when a provider reports an exhausted quota (HTTP 429, or a Workers AI allowance error) it is skipped for 120 seconds (`AI_BREAKER_SECONDS`); a rejected key or missing model is skipped for 20 minutes. Timeouts, network errors and empty replies are transient and never blocked. State is two small rows in `ai_provider_state`, written only on failures.
- **Site-wide daily budget:** `AI_SITE_DAILY_LIMIT` (300) messages for all students together per UTC day, then the page falls back to study search.
- **Per student:** 10 messages a day and 3 a minute (`AI_DAILY_LIMIT`, `AI_MINUTE_LIMIT`). Failed requests are refunded.
- **Fallback:** when no provider can answer, or any limit above is reached, the page shows the closest passages from PrepWise's own notes, labelled as a search result.

**Live test (real providers):** Groq answered text with a cited PrepWise source and "Red" for the image question; Workers AI alone also answered the text question with a citation and "Red." for the image; OpenRouter was rate limited.

**Tests:** 151 unit tests (provider runner that is not an HTTP endpoint, error mapping, breaker rules). `scripts/smoke-ai.mjs --mock` still passes (30+ checks), and a new local-only `scripts/smoke-ai-limits.mjs` (12 checks) proves the breaker skips a limited provider without calling it, a recovered provider stays skipped until the block ends, a transient error does not block, everything-out-of-quota answers at once without calling anyone and without using the student's allowance, and the site budget refuses the fifth message for every student.

**Limits you should know:** the numbers above are the providers' free allowances today and can change; the Workers AI Neuron costs are my arithmetic from their price list; with these protections the combined free capacity is still only a few hundred messages a day, which is why the fallback exists.
