import type { OpenAiMessage, ProviderConfig } from "@prepwise/core";
import { MAX_REPLY_TOKENS } from "@prepwise/core";
import type { Bindings } from "./http";

// Providers, tried in AI_PROVIDERS order. "groq" and "openrouter" are HTTP chat endpoints that need a key (Worker
// secret). "workersai" is Cloudflare's own AI through the `AI` binding: no key, a free daily allowance (10,000
// "Neurons") on the account that already hosts the app. "gemini" is still supported but not in the default order.
const DEFAULTS: Record<string, { baseUrl: string; model: string; headers?: Record<string, string> }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "qwen/qwen3.8-27b" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "google/gemma-4-31b-it:free", headers: { "X-Title": "PrepWise" } },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash" },
};

export const WORKERSAI_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const WORKERSAI_VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const KNOWN = new Set([...Object.keys(DEFAULTS), "workersai"]);

export const aiEnabled = (env: Bindings) => env.AI_ENABLED === "true";

/** The text of a reply, whichever shape the model returned (plain `response`, OpenAI-style `choices`, or `result`). */
export function workersAiText(out: unknown): string {
  const o = out as { response?: unknown; result?: { response?: unknown }; choices?: { message?: { content?: unknown } }[] } | string | null;
  if (typeof o === "string") return o;
  const raw = o?.response ?? o?.choices?.[0]?.message?.content ?? o?.result?.response;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((x: { text?: string }) => x?.text ?? "").join("");
  return "";
}

function workersAi(env: Bindings): ProviderConfig | null {
  const ai = env.AI;
  if (!ai) return null;
  const text = env.WORKERSAI_MODEL || WORKERSAI_TEXT_MODEL;
  const vision = env.WORKERSAI_VISION_MODEL || WORKERSAI_VISION_MODEL;
  return {
    id: "workersai", baseUrl: "", model: text, apiKey: "binding", vision: true,
    run: async (messages: OpenAiMessage[], ctx) => workersAiText(await ai.run(ctx.hasImage ? vision : text, { messages, max_tokens: MAX_REPLY_TOKENS })),
  };
}

/** Providers that are usable (a key, or the AI binding), in the configured order. A missing one is simply absent. */
export function configuredProviders(env: Bindings): ProviderConfig[] {
  const keys: Record<string, string | undefined> = { gemini: env.GEMINI_API_KEY, groq: env.GROQ_API_KEY, openrouter: env.OPENROUTER_API_KEY };
  const models: Record<string, string | undefined> = { gemini: env.GEMINI_MODEL, groq: env.GROQ_MODEL, openrouter: env.OPENROUTER_MODEL };
  const bases: Record<string, string | undefined> = { gemini: env.GEMINI_BASE_URL, groq: env.GROQ_BASE_URL, openrouter: env.OPENROUTER_BASE_URL };
  const order = (env.AI_PROVIDERS ?? "groq,workersai,openrouter").split(",").map((s) => s.trim().toLowerCase()).filter((s) => KNOWN.has(s));
  const out: ProviderConfig[] = [];
  for (const id of [...new Set(order)]) {
    if (id === "workersai") { const w = workersAi(env); if (w) out.push(w); continue; }
    if (!keys[id]) continue;
    out.push({
      id,
      baseUrl: bases[id] || DEFAULTS[id].baseUrl,
      model: models[id] || DEFAULTS[id].model,
      apiKey: keys[id] as string,
      vision: true, // a model that cannot read images answers 400 and the chain moves on
      headers: DEFAULTS[id].headers,
    });
  }
  return out;
}

const num = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
/** Messages one student may send per day, per minute, and all students together per day. */
export const dailyLimit = (env: Bindings) => num(env.AI_DAILY_LIMIT, 10, 1, 500);
export const siteDailyLimit = (env: Bindings) => num(env.AI_SITE_DAILY_LIMIT, 300, 1, 100000);
export const minuteLimit = (env: Bindings) => num(env.AI_MINUTE_LIMIT, 3, 1, 60);
/** Seconds to skip a provider after a quota error (0 turns the circuit breaker off). */
export const breakerSeconds = (env: Bindings) => num(env.AI_BREAKER_SECONDS, 120, 0, 3600);
