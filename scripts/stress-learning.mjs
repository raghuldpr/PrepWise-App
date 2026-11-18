// Worst-case generation cost check against the Workers Free plan CPU limit (10 ms per request).
// A request over the limit fails with HTTP 500/503 (Cloudflare error 1102), so failures here mean "too heavy".
// Usage: node scripts/stress-learning.mjs https://your-worker.workers.dev
const BASE = process.argv[2];
let cookie = "";
const call = async (method, path, body) => {
  const t0 = performance.now();
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get("set-cookie");
  if (set?.startsWith("pw_session=")) cookie = set.split(";")[0];
  const text = await r.text();
  return { status: r.status, ms: Math.round(performance.now() - t0), text };
};

await call("POST", "/api/auth/register", { name: "Stress", email: `stress_${Date.now()}@example.com`, password: "Sup3r-secret!" });
const roles = ["software-engineer", "backend-developer", "frontend-developer", "full-stack-developer", "data-analyst", "data-scientist", "devops-engineer", "mobile-developer", "qa-engineer"];
const rows = [];
for (const roleId of roles) {
  for (const [label, path, body] of [
    ["roadmap", "/api/roadmap/generate", { roleId, hoursPerWeek: 6 }],
    ["plan 26w x 30h Beginner", "/api/study-plan/generate", { roleId, weeks: 26, hoursPerWeek: 30, level: "Beginner" }],
    ["plan 26w x 6h", "/api/study-plan/generate", { roleId, weeks: 26, hoursPerWeek: 6, level: "Beginner" }],
    ["gap", "/api/skills/analyze", { roleId }],
  ]) {
    const r = await call("POST", path, body);
    rows.push({ roleId, label, status: r.status, ms: r.ms, kb: Math.round(r.text.length / 1024) });
  }
}
const bad = rows.filter((r) => r.status >= 400);
const times = rows.map((r) => r.ms).sort((a, b) => a - b);
console.log(`${rows.length} heavy requests: ${rows.length - bad.length} ok, ${bad.length} failed. round trip p50 ${times[Math.floor(times.length / 2)]} ms, max ${times[times.length - 1]} ms; largest body ${Math.max(...rows.map((r) => r.kb))} KB`);
for (const b of bad) console.log("FAILED", b);
process.exit(bad.length ? 1 : 0);
