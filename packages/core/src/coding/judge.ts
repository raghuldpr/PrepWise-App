import type { CompareMode } from "@prepwise/content";

// Pure helpers for judging a submission. The browser workers run the code; these decide whether outputs match
// and what the overall verdict is, so the rules are tested once and shared by both languages.

const key = (x: unknown) => JSON.stringify(x);
const byKey = (a: unknown, b: unknown) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

/** Put a value in a form where "same answer in a different order" compares equal, when the problem allows it. */
export function canonical(v: unknown, mode: CompareMode): unknown {
  if (mode === "unordered") return Array.isArray(v) ? [...v].sort(byKey) : v;
  if (mode === "unordered-deep") {
    const rec = (x: unknown): unknown => (Array.isArray(x) ? x.map(rec).sort(byKey) : x);
    return rec(v);
  }
  return v;
}

/** Compares results the way JSON would, so 1 and 1.0 match and -0 equals 0. undefined (no return) never matches. */
export function outputsMatch(actual: unknown, expected: unknown, mode: CompareMode): boolean {
  if (actual === undefined) return false;
  const norm = (x: unknown) => JSON.stringify(canonical(JSON.parse(JSON.stringify(x, (_k, val) => (Object.is(val, -0) ? 0 : val))), mode));
  try {
    return norm(actual) === norm(expected);
  } catch {
    return false;
  }
}

export type CaseStatus = "passed" | "failed" | "error" | "timeout";
export type CaseResult = { index: number; status: CaseStatus; actual?: string; message?: string };
export type Verdict = "Accepted" | "Wrong Answer" | "Runtime Error" | "Time Limit Exceeded" | "Compile Error";

/** Short, safe text for showing a value (long arrays are cut). */
export function formatValue(v: unknown, max = 160): string {
  let s: string;
  try {
    s = v === undefined ? "undefined (no value returned)" : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  return s.length > max ? `${s.slice(0, max)}... (${s.length} characters)` : s;
}

export function verdictOf(results: CaseResult[], compileError?: string): Verdict {
  if (compileError) return "Compile Error";
  if (results.some((r) => r.status === "timeout")) return "Time Limit Exceeded";
  if (results.some((r) => r.status === "error")) return "Runtime Error";
  if (results.length > 0 && results.every((r) => r.status === "passed")) return "Accepted";
  return "Wrong Answer";
}
