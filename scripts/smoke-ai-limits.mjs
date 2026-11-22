// LOCAL-ONLY test of the assistant's protection of the free quotas: the circuit breaker and the site-wide daily budget.
// It clears breaker/usage rows in the LOCAL database between steps (wrangler d1 execute --local), so it cannot run
// against a deployed site. Setup: start scripts/mock-ai-server.mjs (port 8788) and a local Worker with
//   AI_PROVIDERS=gemini,groq,openrouter  AI_BREAKER_SECONDS=120  AI_SITE_DAILY_LIMIT=4  AI_MINUTE_LIMIT=5  AI_DAILY_LIMIT=8
//   keys mock-gemini / mock-groq / mock-or and *_BASE_URL=http://localhost:8788/v1
// Usage: node scripts/smoke-ai-limits.mjs http://localhost:8787
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const API_DIR = fileURLToPath(new URL("../apps/api", import.meta.url));
const BASE = process.argv[2] ?? "http://localhost:8787";
const MOCK = "http://localhost:8788";
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + String(extra).slice(0, 400)}`);
  if (!cond) failed++;
};
class Client {
  cookie = "";
  async call(method, path, body) {
    const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get("set-cookie");
    if (set?.startsWith("pw_session=")) this.cookie = set.split(";")[0];
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  }
}
const stamp = Date.now();
const user = async (t) => { const c = new Client(); await c.call("POST", "/api/auth/register", { name: `Lim ${t}`, email: `lim_${t}_${stamp}@example.com`, password: "Sup3r-secret!" }); return c; };
const setMock = (o) => fetch(`${MOCK}/__set`, { method: "POST", body: JSON.stringify(o) });
const mockLog = async () => (await (await fetch(`${MOCK}/__log`)).json());
const calls = async (key) => (await mockLog()).filter((x) => x.key === key).length;
const waitHealthy = async () => { await new Promise((r) => setTimeout(r, 1500)); for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + "/api/health")).ok) return; } catch { /* the local server may be restarting */ } await new Promise((r) => setTimeout(r, 1000)); } };
const clearState = async () => { execSync(`npx wrangler d1 execute prepwise-db --local --command "DELETE FROM ai_provider_state; DELETE FROM ai_site_usage"`, { cwd: API_DIR, stdio: "ignore" }); await waitHealthy(); };
const chat = (c, message) => c.call("POST", "/api/ai/chat", { message });
const who = (r) => (r.json?.attempts ?? []).map((a) => a.provider).join(",");

await clearState();
await setMock({ "mock-gemini": "429", "mock-groq": "500", "mock-or": "ok" });
const u = await user("a");

// ---- circuit breaker
let r = await chat(u, "first");
check("the first message tries every provider in order", r.status === 200 && who(r) === "gemini,groq,openrouter" && r.json.reply.provider === "openrouter", r.text);
const geminiAfterFirst = await calls("mock-gemini");
r = await chat(u, "second");
check("after a quota error the provider is skipped: the next message goes straight to the others", r.status === 200 && who(r) === "groq,openrouter", r.text);
check("and it really was not called (no wasted request)", (await calls("mock-gemini")) === geminiAfterFirst, `${await calls("mock-gemini")} vs ${geminiAfterFirst}`);
await setMock({ "mock-gemini": "ok" });
r = await chat(u, "third");
check("a blocked provider stays skipped even if it has recovered, until the block expires", r.status === 200 && who(r) === "groq,openrouter" && r.json.reply.provider === "openrouter", r.text);
await clearState(); // simulates the block expiring
const u2 = await user("b");
r = await chat(u2, "after the block");
check("once the block is over the provider is used again", r.status === 200 && r.json.reply.provider === "gemini" && r.json.fellBack === false, r.text);
const statusRows = execSync(`npx wrangler d1 execute prepwise-db --local --json --command "SELECT provider FROM ai_provider_state"`, { cwd: API_DIR }).toString();
check("a transient provider error (500) does not block a provider", !/groq/.test(statusRows), statusRows.slice(0, 200));

// ---- everything out of quota
await clearState();
await setMock({ "mock-gemini": "429", "mock-groq": "429", "mock-or": "429" });
const u3 = await user("c");
r = await chat(u3, "all limited");
check("every provider rate limited -> 502 that names each reason", r.status === 502 && /gemini: rate limited/.test(r.json.message) && /openrouter: rate limited/.test(r.json.message), r.text);
const before = (await mockLog()).length;
r = await chat(u3, "again");
check("then the assistant answers at once, without calling any provider, that everything is out of quota", r.status === 502 && /out of quota for the moment/.test(r.json.message) && (await mockLog()).length === before, r.text);
r = await u3.call("GET", "/api/ai/status");
check("those failed requests used none of the student's allowance", r.json.usedToday === 0, r.text);

// ---- site-wide daily budget (AI_SITE_DAILY_LIMIT=4)
await clearState();
await setMock({ "mock-gemini": "ok", "mock-groq": "ok", "mock-or": "ok" });
const users = [await user("d"), await user("e")];
const results = [];
for (let i = 0; i < 4; i++) results.push((await chat(users[i % 2], `site ${i}`)).status);
check("four messages fit in the site budget", results.every((s) => s === 200), results.join());
r = await chat(users[0], "one too many");
check("the fifth is refused for everyone with a clear message (the browser then shows the study-search fallback)", r.status === 429 && /across all students/.test(r.json.message), r.text);
r = await (await user("f")).call("POST", "/api/ai/chat", { message: "a brand new student" });
check("a different student is refused too", r.status === 429 && /across all students/.test(r.json.message), r.text);

await clearState();
console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
