import { describe, expect, it } from "vitest";
import { CODING_PROBLEMS } from "@prepwise/content";
import solutions from "../../../content/src/coding-solutions.json";
import { canonical, formatValue, outputsMatch, verdictOf } from "./judge";

type Sol = { javascript: string; python: string; complexity: string; explanation: string };
const SOL = solutions as Record<string, Sol>;
const run = (code: string, fn: string, args: unknown[]) => new Function(`${code}\nreturn ${fn};`)()(...structuredClone(args));

describe("coding problem bank", () => {
  it("has unique ids, valid fields and enough tests", () => {
    expect(new Set(CODING_PROBLEMS.map((p) => p.id)).size).toBe(CODING_PROBLEMS.length);
    expect(CODING_PROBLEMS.length).toBeGreaterThanOrEqual(25);
    for (const d of ["EASY", "MEDIUM", "HARD"]) expect(CODING_PROBLEMS.filter((p) => p.difficulty === d).length, d).toBeGreaterThanOrEqual(2);
    for (const p of CODING_PROBLEMS) {
      expect(p.tests.length, p.id).toBeGreaterThanOrEqual(6);
      expect(p.hints.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.statement.length, p.id).toBeGreaterThan(40);
      expect(p.starter.javascript, p.id).toContain(`function ${p.fn}(${p.params.join(", ")})`);
      expect(p.starter.python, p.id).toContain(`def ${p.fn}(${p.params.join(", ")}):`);
      expect(SOL[p.id], p.id).toBeTruthy();
    }
  });
  it("every JavaScript reference solution passes all of its tests", () => {
    for (const p of CODING_PROBLEMS)
      for (const [i, t] of p.tests.entries()) expect(outputsMatch(run(SOL[p.id].javascript, p.fn, t.args), t.expected, p.compare), `${p.id} #${i}`).toBe(true);
  });
  it("the starter code and a constant answer do not pass any problem", () => {
    for (const p of CODING_PROBLEMS) {
      const starter = (args: unknown[]) => run(p.starter.javascript, p.fn, args);
      expect(p.tests.every((t) => outputsMatch(starter(t.args), t.expected, p.compare)), `${p.id} starter`).toBe(false);
      const first = p.tests[0].expected;
      expect(p.tests.every((t) => outputsMatch(first, t.expected, p.compare)), `${p.id} constant`).toBe(false);
    }
  });
  it("tests catch plausible wrong solutions", () => {
    const two = CODING_PROBLEMS.find((p) => p.id === "two-sum")!;
    const bad = "function two_sum(nums, target) { for (let i = 0; i < nums.length; i++) for (let j = nums.length - 1; j > i; j--) if (nums[i] + nums[j] === target) return [j, i]; return []; }";
    expect(two.tests.every((t) => outputsMatch(run(bad, "two_sum", t.args), t.expected, two.compare))).toBe(false);
    const bs = CODING_PROBLEMS.find((p) => p.id === "binary-search")!;
    const off = "function search(nums, target) { let lo = 0, hi = nums.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (nums[m] === target) return m; if (nums[m] < target) lo = m + 1; else hi = m - 1; } return -1; }";
    expect(bs.tests.every((t) => outputsMatch(run(off, "search", t.args), t.expected, bs.compare))).toBe(false);
    const greedy = CODING_PROBLEMS.find((p) => p.id === "coin-change")!;
    const g = "function coin_change(coins, amount) { const c = [...coins].sort((a, b) => b - a); let n = 0; for (const x of c) { n += Math.floor(amount / x); amount %= x; } return amount === 0 ? n : -1; }";
    expect(greedy.tests.every((t) => outputsMatch(run(g, "coin_change", t.args), t.expected, greedy.compare))).toBe(false);
  });
  it("keeps every test small enough to send to the browser", () => {
    for (const p of CODING_PROBLEMS) for (const t of p.tests) expect(JSON.stringify(t.args).length, p.id).toBeLessThan(12000);
  });
});

describe("judge helpers", () => {
  it("compares like JSON", () => {
    expect(outputsMatch(1, 1, "exact")).toBe(true);
    expect(outputsMatch(0, -0, "exact")).toBe(true);
    expect(outputsMatch([1, 2], [2, 1], "exact")).toBe(false);
    expect(outputsMatch([1, 2], [2, 1], "unordered")).toBe(true);
    expect(outputsMatch([[2, 1], [3]], [[3], [1, 2]], "unordered")).toBe(false);
    expect(outputsMatch([[2, 1], [3]], [[3], [1, 2]], "unordered-deep")).toBe(true);
    expect(outputsMatch(undefined, null, "exact")).toBe(false);
    expect(outputsMatch("1", 1, "exact")).toBe(false);
    expect(outputsMatch(true, 1, "exact")).toBe(false);
    expect(canonical([3, 1, 2], "unordered")).toEqual([1, 2, 3]);
  });
  it("formats and cuts long values", () => {
    expect(formatValue([1, 2])).toBe("[1,2]");
    expect(formatValue(undefined)).toMatch(/no value returned/);
    expect(formatValue("x".repeat(500))).toMatch(/\.\.\. \(502 characters\)$/);
  });
  it("picks the verdict by severity", () => {
    const r = (status: "passed" | "failed" | "error" | "timeout") => ({ index: 0, status });
    expect(verdictOf([r("passed"), r("passed")])).toBe("Accepted");
    expect(verdictOf([r("passed"), r("failed")])).toBe("Wrong Answer");
    expect(verdictOf([r("failed"), r("error")])).toBe("Runtime Error");
    expect(verdictOf([r("error"), r("timeout")])).toBe("Time Limit Exceeded");
    expect(verdictOf([], "SyntaxError")).toBe("Compile Error");
    expect(verdictOf([])).toBe("Wrong Answer");
  });
});
