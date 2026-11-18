// Probe the deployed Worker (Node fetch avoids a Windows curl/schannel TLS quirk).
const U = process.argv[2];
const get = async (p) => {
  const t0 = performance.now();
  try {
    const r = await fetch(U + p);
    const body = await r.text();
    return `${r.status} (${(performance.now() - t0).toFixed(0)} ms round trip) ${body.slice(0, 160)}`;
  } catch (e) {
    return "ERR " + e.message;
  }
};
console.log("health  :", await get("/api/health"));
console.log("d1      :", await get("/api/spike/db"));
for (const it of [10000, 100000, 210000, 600000]) {
  for (let n = 0; n < 3; n++) console.log(`hash ${it}:`, await get(`/api/spike/hash?iterations=${it}`));
}
