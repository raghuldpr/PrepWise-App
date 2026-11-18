// Smoke test for the optional AI assistant.
//   node scripts/smoke-ai.mjs <worker url>           against a Worker where the assistant is OFF (default production state)
//   node scripts/smoke-ai.mjs <worker url> --mock    against a local Worker wired to scripts/mock-ai-server.mjs (port 8788)
// The --mock Worker needs AI_ENABLED="true", AI_DAILY_LIMIT="8" and keys mock-gemini (rate limited), mock-groq (500), mock-or (ok).
const BASE = process.argv[2] ?? "http://localhost:8787";
const MOCK = process.argv.includes("--mock");
const MOCK_URL = "http://localhost:8788";
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + String(extra).slice(0, 400)}`);
  if (!cond) failed++;
};
class Client {
  cookie = "";
  async call(method, path, body) {
    const r = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get("set-cookie");
    if (set?.startsWith("pw_session=")) this.cookie = set.split(";")[0];
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  }
}
const stamp = Date.now();
const user = async (tag) => {
  const c = new Client();
  await c.call("POST", "/api/auth/register", { name: `AI ${tag}`, email: `ai_${tag}_${stamp}@example.com`, password: "Sup3r-secret!" });
  return c;
};
const setMock = (obj) => fetch(`${MOCK_URL}/__set`, { method: "POST", body: JSON.stringify(obj) });
// 1x1 PNG
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const a = await user("a");
check("status needs a session -> 401", (await new Client().call("GET", "/api/ai/status")).status === 401);
check("chat needs a session -> 401", (await new Client().call("POST", "/api/ai/chat", { message: "hi" })).status === 401);

if (!MOCK) {
  let r = await a.call("GET", "/api/ai/status");
  check("assistant is off by default", r.status === 200 && r.json.enabled === false && r.json.providers.length === 0 && /off|No AI/.test(r.json.reason), r.text);
  r = await a.call("POST", "/api/ai/chat", { message: "hello" });
  check("chat is refused while off -> 403", r.status === 403, r.text);
  r = await a.call("GET", "/api/ai/conversations");
  check("conversation list still works (empty)", r.status === 200 && Array.isArray(r.json) && r.json.length === 0, r.text);
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}

await setMock({ "mock-gemini": "429", "mock-groq": "500", "mock-or": "ok" });
let r = await a.call("GET", "/api/ai/status");
check("status lists the three providers in order", r.json.enabled && r.json.providers.map((p) => p.id).join() === "gemini,groq,openrouter" && r.json.dailyLimit === 8, r.text);
check("status never exposes keys", !/mock-/.test(r.text), r.text);

// ---- validation
check("empty message -> 400", (await a.call("POST", "/api/ai/chat", { message: "   " })).status === 400);
check("over-long message -> 400", (await a.call("POST", "/api/ai/chat", { message: "x".repeat(4001) })).status === 400);
check("SVG disguised as PNG -> 400", (await a.call("POST", "/api/ai/chat", { message: "look", image: { mimeType: "image/png", dataBase64: Buffer.from("<svg onload=alert(1)>").toString("base64") } })).status === 400);
check("unsupported image type -> 400", (await a.call("POST", "/api/ai/chat", { message: "look", image: { mimeType: "image/gif", dataBase64: PNG } })).status === 400);
check("unknown conversation -> 404", (await a.call("POST", "/api/ai/chat", { message: "hi", conversationId: 99999 })).status === 404);
r = await a.call("GET", "/api/ai/status");
check("rejected requests do not use up the daily allowance", r.json.usedToday === 0, r.text);

// ---- fallback: gemini (429) -> groq (500) -> openrouter (ok)
r = await a.call("POST", "/api/ai/chat", { message: "How do I explain my project?" });
const convId = r.json?.conversationId;
check("falls back through two failing providers to the third", r.status === 200 && r.json.reply.provider === "openrouter" && r.json.fellBack === true, r.text);
check("attempts are reported in order without raw provider errors", r.json.attempts.map((x) => `${x.provider}:${x.ok}`).join() === "gemini:false,groq:false,openrouter:true" && r.json.attempts[0].reason === "rate limited" && r.json.attempts[1].reason === "provider error" && !/boom|mock-/.test(JSON.stringify(r.json.attempts)), r.text);
check("each provider got its own model and key", /\[mock-or\/openrouter\/free\]/.test(r.json.reply.content), r.json?.reply?.content);
check("usage counts one message", r.json.usedToday === 1 && r.json.dailyLimit === 8, r.text);

// ---- history, image, context
r = await a.call("POST", "/api/ai/chat", { message: "And in an HR round?", conversationId: convId });
check("history is sent on follow-ups (system + 2 earlier + new = 4)", r.status === 200 && /msgs=4/.test(r.json.reply.content) && r.json.conversationId === convId, r.text);
r = await a.call("POST", "/api/ai/chat", { message: "What is this?", conversationId: convId, image: { mimeType: "image/png", dataBase64: PNG } });
check("an image is passed to the provider", r.status === 200 && /image=true/.test(r.json.reply.content), r.text);
r = await a.call("POST", "/api/ai/chat", { message: "Plan my week", conversationId: convId, shareContext: true });
check("role and skill names are shared when the student ticks the box", r.status === 200 && /ctx=true/.test(r.json.reply.content), r.text);
r = await a.call("POST", "/api/ai/chat", { message: "Plan my week", conversationId: convId, shareContext: false });
check("no context is sent by default", /ctx=false/.test(r.json?.reply?.content ?? ""), r.text);

// ---- stored conversation
r = await a.call("GET", `/api/ai/conversations/${convId}`);
check("conversation stores text, who answered and that an image was attached, never the image", r.status === 200 && r.json.messages.length === 10 && r.json.messages.some((m) => m.hadImage) && r.json.messages.filter((m) => m.role === "assistant").every((m) => m.provider === "openrouter") && !r.text.includes(PNG), r.text.slice(0, 300));
check("title comes from the first message", r.json.title === "How do I explain my project?", r.json?.title);

// ---- all providers down: clear error, no allowance used
const d = await user("d");
const before = (await d.call("GET", "/api/ai/status")).json.usedToday;
await setMock({ "mock-or": "500" });
r = await d.call("POST", "/api/ai/chat", { message: "anyone there?" });
check("every provider failing -> 502 with a readable summary", r.status === 502 && /Every AI provider failed/.test(r.json.message) && /gemini: rate limited/.test(r.json.message) && !/mock-|boom/.test(r.text), r.text);
check("a failed request is refunded", (await d.call("GET", "/api/ai/status")).json.usedToday === before);
await setMock({ "mock-or": "ok", "mock-groq": "empty" });
r = await d.call("POST", "/api/ai/chat", { message: "empty then ok" });
check("an empty reply counts as a failure and the next provider answers", r.status === 200 && r.json.reply.provider === "openrouter" && r.json.attempts.some((x) => x.reason === "empty reply"), r.text);
await setMock({ "mock-gemini": "ok" });
r = await d.call("POST", "/api/ai/chat", { message: "primary recovered" });
check("the first provider is used again as soon as it works", r.status === 200 && r.json.reply.provider === "gemini" && r.json.fellBack === false, r.text);
await setMock({ "mock-gemini": "429", "mock-groq": "500" });

// ---- limits and isolation
const b = await user("b");
check("another user cannot read the conversation -> 404", (await b.call("GET", `/api/ai/conversations/${convId}`)).status === 404);
check("another user cannot continue it -> 404", (await b.call("POST", "/api/ai/chat", { message: "hi", conversationId: convId })).status === 404);
check("another user cannot delete it -> 404", (await b.call("DELETE", `/api/ai/conversations/${convId}`)).status === 404);
const c2 = await user("c");
let last;
for (let i = 0; i < 6; i++) last = await c2.call("POST", "/api/ai/chat", { message: `burst ${i}` });
check("more than 5 messages a minute -> 429", last.status === 429 && /Slow down/.test(last.json.message), last.text);
r = await a.call("GET", "/api/ai/conversations");
check("conversation list is per user", r.status === 200 && r.json.length >= 1 && (await b.call("GET", "/api/ai/conversations")).json.length === 0);
check("owner deletes it", (await a.call("DELETE", `/api/ai/conversations/${convId}`)).status === 200 && (await a.call("GET", `/api/ai/conversations/${convId}`)).status === 404);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
