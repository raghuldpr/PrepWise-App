// Simulation: does bandit-chosen practice teach a (synthetic) student more than other ways of choosing topics?
//   node scripts/simulate-bandit.mjs
// The student has K topics, each with a skill (probability of answering right). Practising a topic raises its skill
// with diminishing returns: skill += RATE * (CEILING - skill). We compare policies on the AVERAGE SKILL after T
// practice questions, over many random students. This is a model of learning I made up, not data from real students;
// it shows the policy behaves as designed, not that real students would improve this much.
import { chooseArm, mulberry32 } from "../packages/core/src/bandit/engine.ts";

const K = 8, RUNS = 400, RATE = 0.06, CEILING = 0.95, WINDOW = 40;
let T = 120;

function run(policy, seed) {
  const rng = mulberry32(seed);
  const skill = Array.from({ length: K }, () => 0.15 + 0.65 * rng());
  const initial = skill.reduce((a, b) => a + b, 0) / K;
  const history = []; // { arm, right }
  let rr = 0;
  const curve = [];
  for (let t = 0; t < T; t++) {
    let arm;
    if (policy === "random") arm = Math.floor(rng() * K);
    else if (policy === "round-robin") arm = rr++ % K;
    else if (policy === "oracle (knows true skill)") arm = skill.indexOf(Math.min(...skill));
    else {
      const recent = history.slice(-WINDOW);
      const stats = Array.from({ length: K }, (_, a) => ({
        arm: a, name: `T${a}`,
        right: recent.filter((h) => h.arm === a && h.right).length,
        wrong: recent.filter((h) => h.arm === a && !h.right).length,
      }));
      if (policy === "greedy (no exploration)") {
        const rate = (s) => (s.right + s.wrong === 0 ? 1 : s.wrong / (s.right + s.wrong));
        arm = stats.reduce((m, s) => (rate(s) > rate(m) ? s : m)).arm;
      } else arm = chooseArm(stats, seed * 7919 + t).arm; // Thompson sampling
    }
    const right = rng() < skill[arm];
    history.push({ arm, right });
    skill[arm] += RATE * (CEILING - skill[arm]);
    curve.push(skill.reduce((a, b) => a + b, 0) / K);
  }
  return { initial, final: curve[T - 1], area: curve.reduce((a, b) => a + b, 0) / T, gain: curve[T - 1] - initial };
}

const policies = ["random", "round-robin", "greedy (no exploration)", "thompson sampling (bandit)", "oracle (knows true skill)"];
const name = (p) => (p.startsWith("thompson") ? "thompson" : p);
const stat = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); return { m, ci: (1.96 * sd) / Math.sqrt(xs.length) }; };

for (const budget of [40, 120]) {
  T = budget;
  console.log(`\n=== ${T} practice questions, ${RUNS} synthetic students, ${K} topics, learning rate ${RATE} ===`);
  console.log("policy".padEnd(30), "skill gained (mean +/- 95% CI)");
  const gains = {};
  for (const p of policies) {
    gains[p] = [];
    for (let s = 1; s <= RUNS; s++) gains[p].push(run(name(p), s).gain);
    const g = stat(gains[p]);
    console.log(p.padEnd(30), `${g.m.toFixed(3)} +/- ${g.ci.toFixed(3)}`);
  }
  const paired = (a, b) => stat(gains[a].map((x, i) => x - gains[b][i]));
  for (const other of ["random", "round-robin", "greedy (no exploration)"]) {
    const d = paired("thompson sampling (bandit)", other);
    console.log(`  thompson minus ${other}:`.padEnd(40), `${d.m >= 0 ? "+" : ""}${d.m.toFixed(4)} +/- ${d.ci.toFixed(4)} (paired)${d.m - d.ci > 0 ? "  significant" : d.m + d.ci < 0 ? "  significantly worse" : "  not significant"}`);
  }
}
console.log("\nThis is a model of learning I made up, not data from real students. It checks that the policy behaves as designed.");
