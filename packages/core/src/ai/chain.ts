// Calls OpenAI-compatible chat endpoints (Gemini, Groq and OpenRouter all offer one) and falls back to the next
// provider when one fails. Pure: the caller supplies `fetch`, so the chain is tested without a network.

export type ImagePart = { mimeType: string; dataBase64: string };
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ProviderConfig = {
  id: string; // "gemini" | "groq" | "openrouter" (or any label)
  baseUrl: string; // for example https://api.groq.com/openai/v1
  model: string;
  apiKey: string;
  vision: boolean;
  headers?: Record<string, string>;
  /** For providers that are not an HTTP chat endpoint (the Cloudflare Workers AI binding): returns the reply text. */
  run?: (messages: OpenAiMessage[], ctx: { hasImage: boolean }) => Promise<string>;
};

/** Short replies are plenty for placement questions, and fewer tokens stretch the free quotas. */
export const MAX_REPLY_TOKENS = 450;

export type Attempt = { provider: string; ok: boolean; status?: number; ms: number; reason?: string };
export type ChainResult = { text: string; provider: string; model: string; attempts: Attempt[] };

export class ChainError extends Error {
  constructor(message: string, public attempts: Attempt[]) {
    super(message);
  }
}

export type OpenAiMessage = { role: "system" | "user" | "assistant"; content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };

export function buildMessages(system: string, history: ChatTurn[], userText: string, image?: ImagePart): OpenAiMessage[] {
  const last: OpenAiMessage = image
    ? { role: "user", content: [{ type: "text", text: userText }, { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.dataBase64}` } }] }
    : { role: "user", content: userText };
  return [{ role: "system", content: system }, ...history.map((h) => ({ role: h.role, content: h.content }) as OpenAiMessage), last];
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/** Short reason for a failure that is safe to show: never includes the key or the provider's raw body. */
const reasonFor = (status: number) =>
  status === 429 ? "rate limited" : status === 401 || status === 403 ? "key rejected" : status === 404 ? "model or URL not found" : status === 400 ? "request rejected" : status >= 500 ? "provider error" : `HTTP ${status}`;

/** Maps an error thrown by a non-HTTP provider to the same short reasons the HTTP path uses. */
function classifyRunError(err: unknown): { status: number; message: string } {
  const m = String((err as { message?: string })?.message ?? err);
  if (/neuron|allocation|quota|rate|limit|capacity|too many|429/i.test(m)) return { status: 429, message: "rate limited" };
  if (/auth|permission|forbidden|not allowed|agree|license|401|403/i.test(m)) return { status: 403, message: "key rejected" };
  if (/not found|no such model|unknown model|deprecat|404/i.test(m)) return { status: 404, message: "model or URL not found" };
  return { status: 500, message: "provider error" };
}

export async function callProvider(p: ProviderConfig, messages: OpenAiMessage[], fetchFn: Fetch, timeoutMs: number, hasImage = false): Promise<{ text: string; status: number }> {
  if (p.run) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const text = await Promise.race([
        p.run(messages, { hasImage }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("timed out"), { status: 0, timeout: true })), timeoutMs); }),
      ]);
      if (!String(text ?? "").trim()) throw Object.assign(new Error("empty reply"), { status: 200 });
      return { text: String(text).trim(), status: 200 };
    } catch (err) {
      const e = err as { status?: number; message?: string; timeout?: boolean };
      if (e.timeout || e.message === "empty reply") throw err;
      const c = classifyRunError(err);
      throw Object.assign(new Error(c.message), { status: c.status });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${p.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}`, ...(p.headers ?? {}) },
      body: JSON.stringify({ model: p.model, messages, temperature: 0.4, max_tokens: MAX_REPLY_TOKENS }),
      signal: ctl.signal,
    });
    if (!res.ok) throw Object.assign(new Error(reasonFor(res.status)), { status: res.status });
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const raw = data.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((x: { text?: string }) => x?.text ?? "").join("") : "";
    if (!text.trim()) throw Object.assign(new Error("empty reply"), { status: res.status });
    return { text: text.trim(), status: res.status };
  } catch (err) {
    const e = err as { name?: string; status?: number; message?: string };
    if (e.name === "AbortError") throw Object.assign(new Error("timed out"), { status: 0 });
    if (e.status !== undefined) throw err;
    throw Object.assign(new Error("network error"), { status: 0 });
  } finally {
    clearTimeout(timer);
  }
}

/** Tries providers in order. Providers that cannot see images are skipped when the message has one. */
export async function runChain(providers: ProviderConfig[], messages: OpenAiMessage[], hasImage: boolean, fetchFn: Fetch, opts: { timeoutMs?: number; now?: () => number } = {}): Promise<ChainResult> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const now = opts.now ?? (() => Date.now());
  const attempts: Attempt[] = [];
  const usable = providers.filter((p) => p.apiKey && (!hasImage || p.vision));
  if (!usable.length) throw new ChainError(hasImage ? "No configured provider can read images." : "No AI provider is configured.", attempts);
  for (const p of usable) {
    const t0 = now();
    try {
      const { text, status } = await callProvider(p, messages, fetchFn, timeoutMs, hasImage);
      attempts.push({ provider: p.id, ok: true, status, ms: now() - t0 });
      return { text, provider: p.id, model: p.model, attempts };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      attempts.push({ provider: p.id, ok: false, status: e.status || undefined, ms: now() - t0, reason: e.message });
    }
  }
  throw new ChainError("Every AI provider failed. Try again in a minute.", attempts);
}

// ---- input checks for images (the Worker never decodes pixels; it checks size and file signature) ----
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 1_000_000;

const SIGNATURES: Record<string, (b: number[]) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

/** Returns an error message, or null when the image looks like what it claims to be and is small enough. */
export function checkImage(img: ImagePart): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(img.mimeType)) return "Use a JPEG, PNG or WebP image.";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(img.dataBase64) || img.dataBase64.length % 4 !== 0) return "The image data is not valid base64.";
  const bytes = Math.floor((img.dataBase64.length * 3) / 4) - (img.dataBase64.endsWith("==") ? 2 : img.dataBase64.endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) return `The image is too large (limit ${Math.round(MAX_IMAGE_BYTES / 1000)} KB after resizing).`;
  const head = atob(img.dataBase64.slice(0, 20)).split("").map((c) => c.charCodeAt(0));
  if (!SIGNATURES[img.mimeType](head)) return "The file does not match its image type.";
  return null;
}

// ---- circuit breaker: stop calling a provider that has just told us it is out of quota -------------------------------
// State is a map of provider id to "blocked until" (epoch ms), kept by the caller (the API stores it in D1).

/** Providers that may be tried now. */
export function availableProviders(providers: ProviderConfig[], blockedUntil: Record<string, number>, now: number): ProviderConfig[] {
  return providers.filter((p) => !(blockedUntil[p.id] > now));
}

/**
 * How long to skip a provider after a failed attempt, or null to keep trying it.
 * A rate limit or exhausted quota is skipped for `seconds`; a rejected key or missing model for ten times as long
 * (it will not fix itself); timeouts, network errors, server errors and empty replies are transient and never blocked.
 */
export function blockUntil(attempt: Attempt, now: number, seconds: number): number | null {
  if (attempt.ok || seconds <= 0) return null;
  if (attempt.reason === "rate limited") return now + seconds * 1000;
  if (attempt.reason === "key rejected" || attempt.reason === "model or URL not found") return now + seconds * 10_000;
  return null;
}
