import { INTERVIEW_QUESTIONS, type InterviewDifficulty, type InterviewKind, type InterviewQuestion } from "@prepwise/content";

export type InterviewType = "TECHNICAL" | "HR" | "MIXED";
const LEVELS: InterviewDifficulty[] = ["EASY", "MEDIUM", "HARD"];

/** Which kind of question comes at each position. Mixed rounds spread HR questions through the interview. */
export function planKinds(type: InterviewType, count: number): InterviewKind[] {
  if (type === "TECHNICAL") return Array(count).fill("TECHNICAL");
  if (type === "HR") return Array(count).fill("HR");
  const hr = Math.max(1, Math.round(count * 0.4));
  return Array.from({ length: count }, (_, i) => (Math.floor(((i + 1) * hr) / count) > Math.floor((i * hr) / count) ? "HR" : "TECHNICAL"));
}

/** Small stable hash so each interview gets a different but reproducible order. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Adaptive difficulty: two good answers in a row go up a level, two weak ones go down. */
export function targetDifficulty(base: InterviewDifficulty, lastScores: number[]): InterviewDifficulty {
  let idx = LEVELS.indexOf(base);
  const recent = lastScores.slice(-2);
  if (recent.length === 2) {
    const avg = (recent[0] + recent[1]) / 2;
    if (avg >= 72) idx += 1;
    else if (avg <= 35) idx -= 1;
  }
  return LEVELS[Math.max(0, Math.min(2, idx))];
}

export type PickInput = {
  kind: InterviewKind;
  asked: string[];
  lastScores: number[];
  base: InterviewDifficulty;
  /** Skills of the target role plus skills the user declared. */
  skills: Set<string>;
  seed: string;
};

export function pickQuestion(input: PickInput): InterviewQuestion | null {
  const target = targetDifficulty(input.base, input.lastScores);
  const askedSet = new Set(input.asked);
  const askedTopics = new Set(INTERVIEW_QUESTIONS.filter((q) => askedSet.has(q.id)).map((q) => q.topic));
  let best: { q: InterviewQuestion; s: number } | null = null;
  for (const q of INTERVIEW_QUESTIONS) {
    if (q.kind !== input.kind || askedSet.has(q.id)) continue;
    const gap = Math.abs(LEVELS.indexOf(q.difficulty) - LEVELS.indexOf(target));
    const overlap = q.skills.filter((s) => input.skills.has(s)).length;
    const s = 6 - gap * 3 + Math.min(2, overlap) * 1.5 + (askedTopics.has(q.topic) ? -4 : 0) + hash(input.seed + q.id) * 2;
    if (!best || s > best.s) best = { q, s };
  }
  return best?.q ?? null;
}

export function availableCounts() {
  const tech = INTERVIEW_QUESTIONS.filter((q) => q.kind === "TECHNICAL").length;
  return { technical: tech, hr: INTERVIEW_QUESTIONS.length - tech };
}
