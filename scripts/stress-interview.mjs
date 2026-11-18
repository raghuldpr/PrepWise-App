// Worst-case cost check against the Workers Free plan CPU limit (10 ms per request).
// Every answer is the maximum 4000 characters and stuffed with matching words; every interview is the longest
// (10 questions). A request over the CPU limit fails with HTTP 5xx, so failures here mean "too heavy".
// Usage: node scripts/stress-interview.mjs https://your-worker.workers.dev
const BASE = process.argv[2];
let cookie = "";
const call = async (method, path, body) => {
  const t0 = performance.now();
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get("set-cookie");
  if (set?.startsWith("pw_session=")) cookie = set.split(";")[0];
  const text = await r.text();
  return { status: r.status, ms: Math.round(performance.now() - t0), kb: Math.round(text.length / 1024), json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
};

await call("POST", "/api/auth/register", { name: "Stress", email: `istress_${Date.now()}@example.com`, password: "Sup3r-secret!" });
const stuffing = ("atomicity consistency isolation durability index b-tree hash collision chaining thread process mutex deadlock tcp udp handshake dns http " +
  "for example I led the team and I decided; as a result we delivered 95% on time. ").repeat(60).slice(0, 4000);
const rows = [];
for (const type of ["MIXED", "TECHNICAL", "HR"]) {
  for (let round = 0; round < 3; round++) {
    const created = await call("POST", "/api/interviews", { interviewType: type, difficulty: "HARD", numberOfQuestions: 10, roleId: "full-stack-developer" });
    rows.push({ label: `${type} create`, ...created });
    let q = created.json?.currentQuestion;
    const id = created.json?.id;
    while (q) {
      const r = await call("POST", `/api/interviews/${id}/answer`, { questionId: q.id, answerText: stuffing, secondsTaken: 30 });
      rows.push({ label: `${type} answer`, ...r });
      q = r.json?.nextQuestion;
    }
    rows.push({ label: `${type} report`, ...(await call("GET", `/api/interviews/${id}/report`)) });
  }
}
const bad = rows.filter((r) => r.status >= 400);
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
console.log(`${rows.length} requests: ${rows.length - bad.length} ok, ${bad.length} failed. round trip p50 ${ms[Math.floor(ms.length / 2)]} ms, max ${ms[ms.length - 1]} ms; largest body ${Math.max(...rows.map((r) => r.kb))} KB`);
for (const b of bad) console.log("FAILED", b.label, b.status);
process.exit(bad.length ? 1 : 0);
