// Smoke test for login lockout, log out of all devices, password change sessions and response headers.
// Usage: node scripts/smoke-security.mjs http://localhost:8787
const BASE = process.argv[2] ?? "http://localhost:8787";
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + String(extra).slice(0, 300)}`);
  if (!cond) failed++;
};
class Client {
  cookie = "";
  async call(method, path, body, raw = false) {
    const r = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get("set-cookie");
    if (set?.startsWith("pw_session=")) this.cookie = set.split(";")[0];
    if (set?.startsWith("pw_session=;") || /pw_session=;/.test(set ?? "")) this.cookie = "";
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers };
  }
}
const stamp = Date.now();
const pw = "Sup3r-secret!";
const email = (t) => `sec_${t}_${stamp}@example.com`;
const reg = async (t) => { const c = new Client(); await c.call("POST", "/api/auth/register", { name: `Sec ${t}`, email: email(t), password: pw }); return c; };

// ---- headers
let r = await new Client().call("GET", "/api/health");
check("API sends nosniff, no-store and no-referrer", r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("cache-control") === "no-store" && r.headers.get("referrer-policy") === "no-referrer", JSON.stringify([...r.headers]));
const page = await fetch(BASE + "/");
check("the web app is served with a content security policy and clickjacking protection", /frame-ancestors 'none'/.test(page.headers.get("content-security-policy") ?? "") && page.headers.get("x-frame-options") === "DENY" && page.headers.get("x-content-type-options") === "nosniff", JSON.stringify([...page.headers]).slice(0, 500));

// ---- lockout
const a = await reg("a");
const other = await reg("other");
await a.call("POST", "/api/auth/logout");
const login = (e, p) => new Client().call("POST", "/api/auth/login", { email: e, password: p });
for (let i = 1; i <= 4; i++) {
  r = await login(email("a"), `wrong-${i}-password`);
  check(`wrong password ${i} -> 401`, r.status === 401 && r.json.message === "Invalid email or password", r.text);
}
r = await login(email("a"), "wrong-5-password");
check("the 5th wrong password locks the account -> 429", r.status === 429 && /Too many failed attempts/.test(r.json.message), r.text);
r = await login(email("a"), pw);
check("even the right password is refused while locked -> 429", r.status === 429 && /Try again in/.test(r.json.message), r.text);
r = await login(email("other"), pw);
check("other accounts are not affected", r.status === 200, r.text);
r = await login("nobody@example.com", "whatever-pass");
check("unknown emails still get the generic 401", r.status === 401 && r.json.message === "Invalid email or password", r.text);

// ---- a successful login resets the counter (fresh account)
const b = await reg("b");
await b.call("POST", "/api/auth/logout");
for (let i = 0; i < 4; i++) await login(email("b"), "bad-bad-bad");
r = await login(email("b"), pw);
check("a correct login after 4 failures works", r.status === 200, r.text);
for (let i = 0; i < 4; i++) r = await login(email("b"), "bad-bad-bad");
check("and the counter restarted from zero (4 more failures still 401)", r.status === 401, r.text);

// ---- log out of all devices
const c1 = await reg("c");
const c2 = new Client();
r = await c2.call("POST", "/api/auth/login", { email: email("c"), password: pw });
check("a second device signs in", r.status === 200 && (await c2.call("GET", "/api/users/profile")).status === 200);
r = await c1.call("POST", "/api/auth/logout-all");
check("logout-all succeeds and clears this device", r.status === 200 && c1.cookie === "", r.text);
check("the other device is signed out at once", (await c2.call("GET", "/api/users/profile")).status === 401);
check("logout-all needs a session -> 401", (await new Client().call("POST", "/api/auth/logout-all")).status === 401);
r = await c2.call("POST", "/api/auth/login", { email: email("c"), password: pw });
check("signing in again works", r.status === 200 && (await c2.call("GET", "/api/users/profile")).status === 200);

// ---- change password ends the other sessions but keeps this one
const d1 = await reg("d");
const d2 = new Client();
await d2.call("POST", "/api/auth/login", { email: email("d"), password: pw });
r = await d1.call("POST", "/api/users/change-password", { currentPassword: pw, newPassword: "Brand-new-pass1" });
check("password change succeeds", r.status === 200, r.text);
check("this device stays signed in", (await d1.call("GET", "/api/users/profile")).status === 200);
check("the other device is signed out", (await d2.call("GET", "/api/users/profile")).status === 401);
check("old password no longer works, new one does", (await login(email("d"), pw)).status === 401 && (await login(email("d"), "Brand-new-pass1")).status === 200);

// ---- a forged or tampered cookie
const forged = new Client();
forged.cookie = "pw_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwic3YiOjF9.invalid";
check("a forged cookie is refused", (await forged.call("GET", "/api/users/profile")).status === 401);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
