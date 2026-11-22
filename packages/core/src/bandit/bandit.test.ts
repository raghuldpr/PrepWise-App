import { describe, expect, it } from "vitest";
import { chooseArm, mulberry32, rollingAccuracy, sampleBeta, practiceDifficulty, type ArmStat } from "./engine";

const arms = (spec: [number, number][]): ArmStat[] => spec.map(([right, wrong], i) => ({ arm: i + 1, name: `Topic ${i + 1}`, right, wrong }));

describe("bandit engine", () => {
  it("is deterministic for a seed and varies across seeds", () => {
    const s = arms([[5, 5], [5, 5], [5, 5]]);
    expect(chooseArm(s, 42)).toEqual(chooseArm(s, 42));
    expect(new Set(Array.from({ length: 30 }, (_, i) => chooseArm(s, i)!.arm)).size).toBeGreaterThan(1);
  });
  it("returns null with no arms and handles a single arm", () => {
    expect(chooseArm([], 1)).toBeNull();
    expect(chooseArm(arms([[0, 0]]), 1)?.arm).toBe(1);
  });
  it("draws Beta samples with the right mean and stays in (0,1)", () => {
    const rng = mulberry32(7);
    const xs = Array.from({ length: 4000 }, () => sampleBeta(3, 7, rng));
    expect(xs.every((x) => x > 0 && x < 1)).toBe(true);
    expect(xs.reduce((a, b) => a + b, 0) / xs.length).toBeCloseTo(0.3, 1);
    const rng2 = mulberry32(9);
    const small = Array.from({ length: 4000 }, () => sampleBeta(1, 1, rng2));
    expect(small.reduce((a, b) => a + b, 0) / small.length).toBeCloseTo(0.5, 1);
  });
  it("practises the weak topic most often but still explores the others", () => {
    const s = arms([[18, 2], [10, 10], [3, 17]]); // topic 3 is weakest
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 600; i++) counts[chooseArm(s, i)!.arm]++;
    expect(counts[3]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[2]).toBeGreaterThan(0); // an uncertain, middling topic is still explored
    // A clearly mastered topic (18 right, 2 wrong) is rarely or never drawn; it returns once its old answers leave
    // the sliding window and the belief about it becomes uncertain again.
    expect(counts[3] / 600).toBeGreaterThan(0.6);
  });
  it("is drawn to a topic with no recent answers", () => {
    const s = arms([[10, 0], [10, 0], [0, 0]]);
    const picks = Array.from({ length: 200 }, (_, i) => chooseArm(s, i)!.arm);
    expect(picks.filter((a) => a === 3).length).toBeGreaterThan(100);
  });
  it("explains the choice and marks exactly one arm as chosen", () => {
    const p = chooseArm(arms([[1, 9], [9, 1]]), 3)!;
    expect(p.arms.filter((a) => a.chosen)).toHaveLength(1);
    expect(p.arms.find((a) => a.arm === p.arm)!.chosen).toBe(true);
    expect(["explore", "exploit"]).toContain(p.mode);
    expect(p.reason).toMatch(/Topic/);
    expect(p.arms.every((a) => a.sampled > 0 && a.sampled < 1 && a.wrongRate > 0 && a.wrongRate < 1)).toBe(true);
  });
  it("labels the pick as exploit when it is the weakest topic", () => {
    const s = arms([[19, 1], [1, 19]]);
    const modes = Array.from({ length: 50 }, (_, i) => chooseArm(s, i)!).filter((p) => p.arm === 2);
    expect(modes.every((p) => p.mode === "exploit")).toBe(true);
  });
});

describe("difficulty and curve helpers", () => {
  it("adapts difficulty to the latest answers", () => {
    expect(practiceDifficulty([])).toBe("MEDIUM");
    expect(practiceDifficulty([true, true])).toBe("MEDIUM");
    expect(practiceDifficulty([true, true, true, true])).toBe("HARD");
    expect(practiceDifficulty([false, false, true, false])).toBe("EASY");
    expect(practiceDifficulty([false, false, false, true, true, true, true, true])).toBe("HARD"); // only the last 6 count
    expect(practiceDifficulty([true, false, true, false, true, false])).toBe("MEDIUM");
  });
  it("computes a rolling accuracy", () => {
    expect(rollingAccuracy([])).toEqual([]);
    expect(rollingAccuracy([true, false, true, true], 2)).toEqual([100, 50, 50, 100]);
    expect(rollingAccuracy([true, true, true, true, false], 10)).toEqual([100, 100, 100, 100, 80]);
  });
});

describe("simulation: bandit practice teaches more than random practice", () => {
  const K = 8, T = 60, RATE = 0.06, CEIL = 0.95;
  function gain(policy: "random" | "thompson", seed: number) {
    const rng = mulberry32(seed);
    const skill = Array.from({ length: K }, () => 0.15 + 0.65 * rng());
    const start = skill.reduce((a, b) => a + b, 0) / K;
    const hist: { arm: number; right: boolean }[] = [];
    for (let t = 0; t < T; t++) {
      let arm: number;
      if (policy === "random") arm = Math.floor(rng() * K);
      else {
        const recent = hist.slice(-40);
        const stats = Array.from({ length: K }, (_, a) => ({ arm: a, name: `T${a}`, right: recent.filter((h) => h.arm === a && h.right).length, wrong: recent.filter((h) => h.arm === a && !h.right).length }));
        arm = chooseArm(stats, seed * 7919 + t)!.arm;
      }
      hist.push({ arm, right: rng() < skill[arm] });
      skill[arm] += RATE * (CEIL - skill[arm]);
    }
    return skill.reduce((a, b) => a + b, 0) / K - start;
  }
  it("gains more skill than random on the same synthetic students (paired)", () => {
    const diffs = Array.from({ length: 250 }, (_, i) => gain("thompson", i + 1) - gain("random", i + 1));
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (diffs.length - 1));
    expect(mean - (1.96 * sd) / Math.sqrt(diffs.length)).toBeGreaterThan(0);
  });
});
