import type { ProviderConfig } from "@prepwise/core";
import type { Bindings } from "./http";

const DEFAULTS: Record<string, { baseUrl: string; model: string; headers?: Record<string, string> }> = {
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "qwen/qwen3.8-27b" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", headers: { "X-Title": "PrepWise" } },
};

export const aiEnabled = (env: Bindings) => env.AI_ENABLED === "true";

/** Providers that have a key, in the configured order. A provider without a key is simply absent. */
export function configuredProviders(env: Bindings): ProviderConfig[] {
  const keys: Record<string, string | undefined> = { gemini: env.GEMINI_API_KEY, groq: env.GROQ_API_KEY, openrouter: env.OPENROUTER_API_KEY };
  const models: Record<string, string | undefined> = { gemini: env.GEMINI_MODEL, groq: env.GROQ_MODEL, openrouter: env.OPENROUTER_MODEL };
  const bases: Record<string, string | undefined> = { gemini: env.GEMINI_BASE_URL, groq: env.GROQ_BASE_URL, openrouter: env.OPENROUTER_BASE_URL };
  const order = (env.AI_PROVIDERS ?? "gemini,groq,openrouter").split(",").map((s) => s.trim().toLowerCase()).filter((s) => s in DEFAULTS);
  return [...new Set(order)]
    .filter((id) => keys[id])
    .map((id) => ({
      id,
      baseUrl: bases[id] || DEFAULTS[id].baseUrl,
      model: models[id] || DEFAULTS[id].model,
      apiKey: keys[id] as string,
      vision: true, // a model that cannot read images answers 400 and the chain moves on
      headers: DEFAULTS[id].headers,
    }));
}

export const dailyLimit = (env: Bindings) => Math.max(1, Math.min(500, Number(env.AI_DAILY_LIMIT) || 25));
export const MINUTE_LIMIT = 5;
