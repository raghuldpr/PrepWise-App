// Adaptive practice as a multi-armed bandit (the simplest reinforcement-learning setting: no state transitions).
//   arm     = a question category
//   pull    = practise one question from that category
//   reward  = 1 when the answer is WRONG (a topic worth practising), 0 when it is right
// Thompson sampling keeps a Beta(1 + wrong, 1 + right) belief about each arm's "wrong rate", draws one sample from
// each belief and practises the arm with the highest draw. Weak topics are chosen more often (exploitation) while
// uncertain topics still get tried (exploration). Only the most recent answers count (a sliding window), because
// a student improves, so an old mistake should not keep a topic "weak" forever.
// Pure and seeded: the same inputs always give the same choice, so it can be tested and a page refresh is stable.
// This file has no imports, so scripts can load it directly.

export type ArmStat = { arm: number; name: string; right: number; wrong: number };
export type ArmView = { arm: number; name: string; attempted: number; wrongRate: number; sampled: number; chosen: boolean };
export type Pick = { arm: number; mode: "explore" | "exploit"; reason: string; arms: ArmView[] };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normal = (rng: () => number) => {
  const u = Math.max(rng(), 1e-12), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Gamma(shape, 1) by Marsaglia and Tsang; used to draw from a Beta distribution. */
function gamma(shape: number, rng: () => number): number {
  if (shape < 1) return gamma(shape + 1, rng) * Math.pow(Math.max(rng(), 1e-12), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(rng);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = rng();
    if (Math.log(Math.max(u, 1e-12)) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}

export function sampleBeta(a: number, b: number, rng: () => number): number {
  const x = gamma(a, rng), y = gamma(b, rng);
  return x / (x + y);
}

export function chooseArm(stats: ArmStat[], seed: number): Pick | null {
  if (stats.length === 0) return null;
  const rng = mulberry32(seed);
  const views: ArmView[] = stats.map((s) => {
    const a = 1 + s.wrong, b = 1 + s.right;
    return { arm: s.arm, name: s.name, attempted: s.right + s.wrong, wrongRate: a / (a + b), sampled: sampleBeta(a, b, rng), chosen: false };
  });
  const best = views.reduce((m, v) => (v.sampled > m.sampled ? v : m));
  best.chosen = true;
  const weakest = views.reduce((m, v) => (v.wrongRate > m.wrongRate ? v : m));
  const exploit = best.arm === weakest.arm;
  const pct = Math.round(best.wrongRate * 100);
  const reason = best.attempted === 0
    ? `You have not practised ${best.name} recently, so it is worth a try.`
    : exploit
      ? `${best.name} is your weakest area right now (about ${pct}% wrong in your latest answers).`
      : `${best.name} is picked to explore: your results there are still uncertain (about ${pct}% wrong over ${best.attempted} answer${best.attempted === 1 ? "" : "s"}).`;
  return { arm: best.arm, mode: exploit ? "exploit" : "explore", reason, arms: views };
}

/** Difficulty to ask next from the recent answers in one category (newest last): true = right. */
export function practiceDifficulty(recent: boolean[]): "EASY" | "MEDIUM" | "HARD" {
  const last = recent.slice(-6);
  if (last.length < 3) return "MEDIUM";
  const acc = last.filter(Boolean).length / last.length;
  return acc >= 0.75 ? "HARD" : acc <= 0.4 ? "EASY" : "MEDIUM";
}

/** Rolling accuracy (0 to 100) after each answer, over the last `window` answers. */
export function rollingAccuracy(correct: boolean[], window = 10): number[] {
  return correct.map((_, i) => {
    const slice = correct.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round((100 * slice.filter(Boolean).length) / slice.length);
  });
}
