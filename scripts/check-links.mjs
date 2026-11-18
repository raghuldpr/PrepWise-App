// Checks that every learning-resource link in packages/content/src/topics.ts still resolves.
// Usage: node scripts/check-links.mjs      (needs network; 403/429 are reported as "blocked", not dead)
import fs from "node:fs";

const src = fs.readFileSync(new URL("../packages/content/src/topics.ts", import.meta.url), "utf8");
const urls = [...new Set([...src.matchAll(/=(https:\/\/[^;\s|`]+)/g)].map((m) => m[1]))];

async function check(url) {
  const opts = { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": "Mozilla/5.0 (link-check for a student project)" } };
  try {
    let r = await fetch(url, { ...opts, method: "HEAD" });
    if ([400, 403, 404, 405].includes(r.status) || r.status >= 500) r = await fetch(url, { ...opts, method: "GET" });
    return { url, status: r.status, final: r.url };
  } catch (e) {
    return { url, status: 0, error: e.cause?.code || e.name };
  }
}

const results = [];
const queue = [...urls];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) results.push(await check(queue.shift()));
}));

const ok = results.filter((r) => r.status >= 200 && r.status < 400);
const blocked = results.filter((r) => r.status === 403 || r.status === 429);
const dead = results.filter((r) => !ok.includes(r) && !blocked.includes(r));
console.log(`${urls.length} links: ${ok.length} ok, ${blocked.length} blocked (403/429), ${dead.length} failing`);
for (const r of blocked) console.log("BLOCKED", r.status, r.url);
for (const r of dead) console.log("FAIL   ", r.status || r.error, r.url);
const moved = ok.filter((r) => r.final && r.final.replace(/\/$/, "") !== r.url.replace(/\/$/, ""));
for (const r of moved) console.log("MOVED  ", r.url, "->", r.final);
process.exit(dead.length ? 1 : 0);
