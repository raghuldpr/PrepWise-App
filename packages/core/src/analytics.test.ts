import { describe, expect, it } from "vitest";
import { classify, classifyAreas, computeStreak, modulePercent } from "./analytics";

const now = new Date("2026-11-18T10:00:00Z");

describe("computeStreak", () => {
  it("is 0 with no activity", () => expect(computeStreak([], now)).toBe(0));
  it("counts consecutive days ending today", () =>
    expect(computeStreak(["2026-11-18", "2026-11-17", "2026-11-16"], now)).toBe(3));
  it("keeps the streak alive if the last day was yesterday", () =>
    expect(computeStreak(["2026-11-17", "2026-11-16"], now)).toBe(2));
  it("breaks after a gap", () =>
    expect(computeStreak(["2026-11-18", "2026-11-16", "2026-11-15"], now)).toBe(1));
  it("is 0 when the last activity was 2+ days ago", () =>
    expect(computeStreak(["2026-11-15", "2026-11-14"], now)).toBe(0));
  it("does not count distinct dates that are not consecutive (old backend bug)", () =>
    expect(computeStreak(["2026-11-18", "2026-11-10", "2026-11-02"], now)).toBe(1));
});

describe("classify / classifyAreas", () => {
  it("buckets by accuracy and ignores untouched categories", () => {
    expect(classify(70, 3)).toBe("strong");
    expect(classify(59.9, 3)).toBe("weak");
    expect(classify(65, 3)).toBe("improve");
    expect(classify(0, 0)).toBeNull();
  });
  it("produces no invented diagnostics for an empty history", () => {
    const r = classifyAreas([]);
    expect(r.strongAreas).toHaveLength(0);
    expect(r.weakAreas).toHaveLength(0);
    expect(r.topicsNeedingImprovement).toHaveLength(0);
  });
  it("adds a practice link", () => {
    const r = classifyAreas([{ categoryName: "OS", moduleType: "TECHNICAL", accuracy: 40, attempted: 5, correct: 2 }]);
    expect((r.weakAreas[0] as { practiceLink: string }).practiceLink).toBe("/placement/technical");
  });
});

describe("modulePercent", () => {
  it("handles empty modules and caps at 100", () => {
    expect(modulePercent(5, 0)).toBe(0);
    expect(modulePercent(10, 8)).toBe(100);
    expect(modulePercent(3, 12)).toBe(25);
  });
});
