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
