// Checks each provider you have a key for: is the model name valid, does it answer, and does it read an image?
// Model names change often, so run this before turning the assistant on and after editing the model settings.
// Keys are read from your shell environment and are never printed or stored.
//   PowerShell:  $env:GEMINI_API_KEY="..."; $env:GROQ_API_KEY="..."; $env:OPENROUTER_API_KEY="..."; node scripts/check-ai-providers.mjs
// Optional: GEMINI_MODEL, GROQ_MODEL, OPENROUTER_MODEL (same names as in apps/api/wrangler.toml).
const P = [
  ["gemini", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai", process.env.GEMINI_MODEL ?? "gemini-3.8-flash"],
  ["groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1", process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b"],
  ["openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", process.env.OPENROUTER_MODEL ?? "openrouter/free"],
];
// 64x64 PNG: a red square on white. A model that sees images will name the colour.
const RED = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYklEQVR4nO3PQQ3AIAAEQUT0jX9ReGktkPDYkszmBNyM9/JGfeA0gDqAOoA6gDqAui3AemYyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAG8OcA6gDqAOoA6gDqrgd8n9y8TrLk8NoAAAAASUVORK5CYII=";

async function ask(base, key, model, content) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "PrepWise check" },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens: 60 }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await r.json().catch(() => ({}));
    const text = body?.choices?.[0]?.message?.content;
    return { ok: r.ok && !!String(text ?? "").trim(), status: r.status, ms: Date.now() - t0, text: String(text ?? body?.error?.message ?? "").slice(0, 80).replace(/\s+/g, " ") };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, text: e.name === "TimeoutError" ? "timed out" : "network error" };
  }
}

let any = false;
for (const [id, envName, base, model] of P) {
  const key = process.env[envName];
  if (!key) { console.log(`${id.padEnd(11)} skipped (no ${envName})`); continue; }
  any = true;
  const text = await ask(base, key, model, "Reply with the single word: ready");
  const image = await ask(base, key, model, [{ type: "text", text: "What colour is the square? One word." }, { type: "image_url", image_url: { url: `data:image/png;base64,${RED}` } }]);
  const sees = image.ok && /red/i.test(image.text);
  console.log(`${id.padEnd(11)} model ${model}`);
  console.log(`            text : ${text.ok ? "OK" : "FAIL"} (HTTP ${text.status}, ${text.ms} ms) ${text.ok ? "" : text.text}`);
  console.log(`            image: ${sees ? "OK" : image.ok ? "answered but did not say red: " + image.text : "FAIL"} (HTTP ${image.status}, ${image.ms} ms) ${image.ok ? "" : image.text}`);
}
if (!any) console.log("No keys found. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY in your environment.");
