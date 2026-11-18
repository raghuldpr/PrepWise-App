import problemsJson from "./coding-problems.json";

// Coding problems with test cases (generated and cross-verified by scripts/author-coding-problems.mjs).
// Reference solutions are NOT exported from the package index: only the API reads coding-solutions.json.

export type CodingLanguage = "javascript" | "python";
export type CompareMode = "exact" | "unordered" | "unordered-deep";
export type CodingTest = { args: unknown[]; expected: unknown };
export type CodingProblem = {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topic: string;
  skills: string[];
  fn: string;
  params: string[];
  compare: CompareMode;
  statement: string;
  constraints: string[];
  hints: string[];
  starter: Record<CodingLanguage, string>;
  tests: CodingTest[];
};

export const CODING_PROBLEMS = problemsJson as unknown as CodingProblem[];
export const CODING_BY_ID = new Map(CODING_PROBLEMS.map((p) => [p.id, p]));
export const CODING_LANGUAGES: CodingLanguage[] = ["javascript", "python"];
