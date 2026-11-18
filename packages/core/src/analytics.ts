// Pure analytics helpers (no I/O) shared by the API and tests.

/** Days (YYYY-MM-DD, UTC) on which the user practised -> current consecutive-day streak.
 *  A streak is still alive if the last active day was today or yesterday. */
export function computeStreak(activeDays: string[], now: Date = new Date()): number {
  if (!activeDays.length) return 0;
  const days = new Set(activeDays);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(fmt(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1); // allow "not yet practised today"
    if (!days.has(fmt(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(fmt(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export const MODULE_LABELS: Record<string, string> = {
  APTITUDE: "Aptitude & Reasoning",
  CODING: "Coding & Problem Solving",
  DSA: "Data Structures & Algorithms",
  TECHNICAL: "Core CS Fundamentals",
  HR: "HR & Behavioral",
};

export function practiceLink(moduleType: string): string {
  switch (moduleType) {
    case "TECHNICAL": return "/placement/technical";
    case "CODING": return "/placement/coding";
    case "DSA": return "/placement/dsa";
    case "HR": return "/mock-interview";
    default: return "/placement/aptitude";
  }
}

export type CategoryStat = { categoryName: string; moduleType: string; accuracy: number; attempted: number; correct: number };
export type AreaBucket = "strong" | "weak" | "improve";

export function classify(accuracy: number, attempted: number): AreaBucket | null {
  if (attempted <= 0) return null;
  if (accuracy >= 70) return "strong";
  if (accuracy < 60) return "weak";
  return "improve";
}

const ADVICE: Record<AreaBucket, string> = {
  strong: "Demonstrating high mastery. Maintain revision with timed challenges.",
  weak: "Accuracy is below 60%. Review fundamental concepts and practice topic-level questions.",
  improve: "Moderate performance. Practice 10-15 targeted questions to reach 75% accuracy.",
};

export function classifyAreas(stats: CategoryStat[]) {
  const out = { strongAreas: [] as unknown[], weakAreas: [] as unknown[], topicsNeedingImprovement: [] as unknown[] };
  for (const s of stats) {
    const bucket = classify(s.accuracy, s.attempted);
    if (!bucket) continue;
    const item = {
      topic: s.categoryName, categoryName: s.categoryName, moduleType: s.moduleType,
      accuracy: s.accuracy, attempted: s.attempted, correct: s.correct,
      recommendation: ADVICE[bucket], practiceLink: practiceLink(s.moduleType),
    };
    (bucket === "strong" ? out.strongAreas : bucket === "weak" ? out.weakAreas : out.topicsNeedingImprovement).push(item);
  }
  return out;
}

/** Share of a module's questions the user has answered correctly at least once. */
export function modulePercent(distinctSolved: number, totalInModule: number): number {
  if (totalInModule <= 0) return 0;
  return Math.round((Math.min(distinctSolved, totalInModule) / totalInModule) * 1000) / 10;
}
