// Smoke test for coding practice tracking (the code itself is judged in the browser).
// Usage: node scripts/smoke-coding.mjs http://localhost:8787
const BASE = process.argv[2] ?? "http://localhost:8787";
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + String(extra).slice(0, 300)}`);
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

const a = new Client(), b = new Client();
const stamp = Date.now();
check("status needs a session -> 401", (await a.call("GET", "/api/coding/status")).status === 401);
check("submit needs a session -> 401", (await a.call("POST", "/api/coding/submissions", {})).status === 401);
await a.call("POST", "/api/auth/register", { name: "Coder A", email: `code_a_${stamp}@example.com`, password: "Sup3r-secret!" });
await b.call("POST", "/api/auth/register", { name: "Coder B", email: `code_b_${stamp}@example.com`, password: "Sup3r-secret!" });

const P = "two-sum"; // 7 tests
const sub = (over = {}) => ({ problemId: P, language: "javascript", code: "function two_sum(a,b){return []}", verdict: "Wrong Answer", passed: 2, total: 7, timeMs: 12, ...over });
let r = await a.call("GET", "/api/coding/status");
check("a new user has no coding status", r.status === 200 && Array.isArray(r.json) && r.json.length === 0, r.text);

// ---- validation
check("unknown problem -> 404", (await a.call("POST", "/api/coding/submissions", sub({ problemId: "nope" }))).status === 404);
check("wrong test count -> 400", (await a.call("POST", "/api/coding/submissions", sub({ total: 3, passed: 1 }))).status === 400);
check("passed above total -> 400", (await a.call("POST", "/api/coding/submissions", sub({ passed: 9 }))).status === 400);
check("Accepted with failures -> 400", (await a.call("POST", "/api/coding/submissions", sub({ verdict: "Accepted", passed: 2 }))).status === 400);
check("all passed but not Accepted -> 400", (await a.call("POST", "/api/coding/submissions", sub({ verdict: "Wrong Answer", passed: 7 }))).status === 400);
check("compile error with passes -> 400", (await a.call("POST", "/api/coding/submissions", sub({ verdict: "Compile Error", passed: 1 }))).status === 400);
check("unknown language -> 400", (await a.call("POST", "/api/coding/submissions", sub({ language: "cobol" }))).status === 400);
check("unknown verdict -> 400", (await a.call("POST", "/api/coding/submissions", sub({ verdict: "Great" }))).status === 400);
check("empty code -> 400", (await a.call("POST", "/api/coding/submissions", sub({ code: "" }))).status === 400);
check("huge code -> 400", (await a.call("POST", "/api/coding/submissions", sub({ code: "x".repeat(20001) }))).status === 400);

// ---- solution gating
r = await a.call("GET", `/api/coding/solution/${P}`);
check("solution is locked before trying -> 403", r.status === 403 && /Try the problem first/.test(r.json.message), r.text);
check("solution of unknown problem -> 404", (await a.call("GET", "/api/coding/solution/nope")).status === 404);

// ---- attempts
r = await a.call("POST", "/api/coding/submissions", sub());
check("a failing attempt is recorded", r.status === 201 && r.json.attempts === 1 && r.json.solved === false && r.json.bestPassed === 2 && r.json.total === 7, r.text);
await a.call("POST", "/api/coding/submissions", sub({ passed: 5 }));
check("still locked after 2 attempts", (await a.call("GET", `/api/coding/solution/${P}`)).status === 403);
r = await a.call("POST", "/api/coding/submissions", sub({ verdict: "Runtime Error", passed: 0 }));
check("best passed is kept across attempts", r.status === 201 && r.json.attempts === 3 && r.json.bestPassed === 5, r.text);
r = await a.call("GET", `/api/coding/solution/${P}`);
check("solution unlocks after 3 attempts", r.status === 200 && /function two_sum/.test(r.json.javascript) && /def two_sum/.test(r.json.python) && r.json.complexity && r.json.explanation, r.text);

// ---- solving
r = await a.call("POST", "/api/coding/submissions", sub({ verdict: "Accepted", passed: 7, language: "python", code: "def two_sum(nums, target):\n    pass" }));
check("an accepted submission marks the problem solved", r.status === 201 && r.json.solved === true && r.json.attempts === 4, r.text);
r = await a.call("GET", "/api/coding/status");
check("status lists the problem", r.status === 200 && r.json.length === 1 && r.json[0].problemId === P && r.json[0].solved, r.text);

r = await a.call("GET", `/api/coding/submissions/${P}`);
check("submission history is newest first with code", r.status === 200 && r.json.length === 4 && r.json[0].verdict === "Accepted" && r.json[0].language === "python" && /def two_sum/.test(r.json[0].code), r.text.slice(0, 200));

// ---- another problem, solved immediately, unlocks solution at once
r = await a.call("POST", "/api/coding/submissions", { problemId: "fizzbuzz", language: "javascript", code: "function fizz_buzz(n){}", verdict: "Accepted", passed: 6, total: 6, timeMs: 3 });
check("a different problem tracks separately", r.status === 201 && r.json.attempts === 1 && r.json.solved, r.text);
check("solving unlocks the solution at once", (await a.call("GET", "/api/coding/solution/fizzbuzz")).status === 200);

// ---- cap per problem
for (let i = 0; i < 12; i++) await a.call("POST", "/api/coding/submissions", sub({ passed: i % 5 }));
r = await a.call("GET", `/api/coding/submissions/${P}`);
check("only the newest 10 submissions per problem are listed", r.status === 200 && r.json.length === 10, String(r.json?.length));
r = await a.call("GET", "/api/coding/status");
check("pruning does not un-solve a problem", r.json.find((x) => x.problemId === P)?.solved === true, r.text);

// ---- isolation
r = await b.call("GET", "/api/coding/status");
check("another user sees none of it", r.status === 200 && r.json.length === 0, r.text);
check("another user's solution is still locked", (await b.call("GET", `/api/coding/solution/${P}`)).status === 403);
r = await b.call("GET", `/api/coding/submissions/${P}`);
check("another user has no submissions", r.status === 200 && r.json.length === 0, r.text);

// ---- analytics
r = await a.call("GET", "/api/users/analytics");
check("analytics counts coding problems tried and solved", r.status === 200 && r.json.codingProgress.attempted === 2 && r.json.codingProgress.solved === 2 && r.json.codingProgress.progressPercent > 0, JSON.stringify(r.json?.codingProgress));
r = await b.call("GET", "/api/users/analytics");
check("a new user has zero coding progress", r.json.codingProgress.attempted === 0 && r.json.codingProgress.progressPercent === 0, JSON.stringify(r.json?.codingProgress));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
