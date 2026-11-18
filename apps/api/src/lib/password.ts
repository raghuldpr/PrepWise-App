// Password hashing for Cloudflare Workers.
// Workers cap PBKDF2 at 100,000 iterations (measured in Iteration 0). We pre-hash with
// HMAC-SHA256 keyed by a server-side pepper, then run PBKDF2-SHA256 with a per-user salt.
const enc = new TextEncoder();
export const PBKDF2_ITERATIONS = 100_000;

const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function peppered(password: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(password));
  return toB64(new Uint8Array(mac));
}

async function derive(password: string, pepper: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(await peppered(password, pepper)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, pepper, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, pepper: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const got = await derive(password, pepper, fromB64(parts[2]), Number(parts[1]));
  const want = fromB64(parts[3]);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// Burn the same CPU as a real check so "unknown email" and "wrong password" look alike.
export async function dummyVerify(password: string, pepper: string): Promise<void> {
  await derive(password, pepper, new Uint8Array(16), PBKDF2_ITERATIONS);
}
