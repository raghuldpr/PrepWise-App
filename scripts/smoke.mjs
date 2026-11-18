// End-to-end smoke test for auth, profile and onboarding.
// Usage: node scripts/smoke.mjs http://localhost:8787
const BASE = process.argv[2] ?? "http://localhost:8787";
let cookie = "";
let failed = 0;

async function call(method, path, body, { origin, noCookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie && !noCookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.get("set-cookie");
  if (set && set.startsWith("pw_session=")) cookie = set.split(";")[0] === "pw_session=" ? "" : set.split(";")[0];
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json, set };
}
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failed++;
}

const email = `smoke_${Date.now()}@example.com`;
const pw = "Sup3r-secret!";

let r = await call("GET", "/api/users/profile");
check("profile without session -> 401", r.status === 401, r.status);

r = await call("POST", "/api/auth/register", { name: "Smoke Tester", email, password: "short" });
check("register weak password -> 400", r.status === 400, JSON.stringify(r.json));

r = await call("POST", "/api/auth/register", { name: "Smoke Tester", email, password: pw });
check("register -> 201 + httpOnly cookie", r.status === 201 && /HttpOnly/i.test(r.set ?? "") && !r.json.token, JSON.stringify(r));
check("register body has no password hash/token", !("passwordHash" in (r.json ?? {})) && !("token" in (r.json ?? {})));
check("onboardingCompleted false at start", r.json?.onboardingCompleted === false);

const dup = await call("POST", "/api/auth/register", { name: "X", email: email.toUpperCase(), password: pw });
check("duplicate email (case-insensitive) -> 409", dup.status === 409, dup.status);

r = await call("GET", "/api/users/profile");
check("profile with session -> 200", r.status === 200 && r.json.email === email, JSON.stringify(r.json));

r = await call("GET", "/api/skills");
check("skills list has seeded rows", r.status === 200 && r.json.length >= 27, r.json?.length);
const skillIds = r.json.slice(0, 3).map((s) => s.id);

r = await call("POST", "/api/onboarding/skills", { skills: [] });
check("onboarding skills empty -> 400", r.status === 400);
r = await call("POST", "/api/onboarding/skills", { skills: [{ skillId: 999999 }] });
check("onboarding unknown skill -> 404", r.status === 404, r.status);
r = await call("POST", "/api/onboarding/skills", { skills: skillIds.map((id) => ({ skillId: id, proficiencyLevel: "ADVANCED" })) });
check("onboarding skills saved", r.status === 200, JSON.stringify(r.json));

r = await call("POST", "/api/onboarding/goals", { targetRole: "Backend Engineer", college: "ABC", graduationYear: 2026, targetCompany: null });
check("onboarding goals -> completed", r.status === 200 && r.json.onboardingCompleted === true && r.json.targetRole === "Backend Engineer", JSON.stringify(r.json));
check("profile lists the 3 skills with level", r.json?.skills?.length === 3 && r.json.skills[0].proficiencyLevel === "ADVANCED");

r = await call("PUT", "/api/users/profile", { name: "Smoke Renamed", bio: "hello", githubUrl: "https://github.com/x", branch: null });
check("update profile", r.status === 200 && r.json.name === "Smoke Renamed" && r.json.bio === "hello" && r.json.targetRole === "Backend Engineer", JSON.stringify(r.json));

r = await call("PUT", "/api/users/settings", { settingsData: '{"language":"en"}' });
check("update settings", r.status === 200 && r.json.settingsData === '{"language":"en"}');
r = await call("GET", "/api/users/settings");
check("get settings", r.status === 200 && r.json.name === "Smoke Renamed");

r = await call("POST", "/api/users/change-password", { currentPassword: "wrong-pass", newPassword: "Another-pass1" });
check("change password wrong current -> 400", r.status === 400, r.status);
r = await call("POST", "/api/users/change-password", { currentPassword: pw, newPassword: "Another-pass1" });
check("change password ok", r.status === 200);

r = await call("POST", "/api/auth/logout");
check("logout clears cookie", r.status === 200 && cookie === "", cookie);
r = await call("GET", "/api/users/profile", null, { noCookie: true });
check("after logout -> 401", r.status === 401);

r = await call("POST", "/api/auth/login", { email, password: pw });
check("old password rejected -> 401 generic", r.status === 401 && /Invalid email or password/.test(r.json.message), JSON.stringify(r.json));
r = await call("POST", "/api/auth/login", { email: "nobody@example.com", password: pw });
check("unknown user -> same 401 message", r.status === 401 && /Invalid email or password/.test(r.json.message));
r = await call("POST", "/api/auth/login", { email: email.toUpperCase(), password: "Another-pass1" });
check("login with new password (case-insensitive email)", r.status === 200 && r.json.onboardingCompleted === true, JSON.stringify(r.json));

r = await call("PUT", "/api/users/profile", { bio: "csrf" }, { origin: "https://evil.example" });
check("cross-origin write blocked -> 403", r.status === 403, r.status);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
