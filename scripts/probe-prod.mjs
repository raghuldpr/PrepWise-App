// Debug helper: repeat a few calls against a deployed URL and print raw status/body/headers.
const BASE = process.argv[2];
const email = `probe_${Date.now()}@example.com`;
const pw = "Sup3r-secret!";
let cookie = "";
async function call(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get("set-cookie");
  if (set?.startsWith("pw_session=")) cookie = set.split(";")[0];
  const text = await r.text();
  console.log(method, path, "->", r.status, text.slice(0, 140), "| cf-ray:", r.headers.get("cf-ray"));
}
await call("POST", "/api/auth/register", { name: "P", email, password: pw });
for (let i = 0; i < 4; i++) await call("GET", "/api/users/profile");
for (let i = 0; i < 3; i++) await call("POST", "/api/auth/register", { name: "P", email, password: pw });
for (let i = 0; i < 3; i++) await call("PUT", "/api/users/settings", { settingsData: '{"a":1}' });
