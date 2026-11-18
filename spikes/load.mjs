// 40 sequential hash+verify calls at 100k iterations (Free plan); count failures/CPU errors.
const U = process.argv[2];
const N = 40;
let ok = 0, bad = 0, times = [];
const errors = new Map();
for (let i = 0; i < N; i++) {
  const t0 = performance.now();
  const r = await fetch(`${U}/api/spike/hash?iterations=100000`);
  const body = await r.text();
  times.push(performance.now() - t0);
  if (r.status === 200) ok++; else { bad++; errors.set(body.slice(0, 120), (errors.get(body.slice(0, 120)) ?? 0) + 1); }
}
times.sort((a, b) => a - b);
console.log({ ok, bad, p50: Math.round(times[N / 2]), p95: Math.round(times[Math.floor(N * 0.95)]), max: Math.round(times[N - 1]) });
console.log([...errors]);
const d = await fetch(`${U}/api/spike/db`); console.log("d1:", d.status, await d.text());
