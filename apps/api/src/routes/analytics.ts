import { Hono } from "hono";
import { classifyAreas, computeStreak, MODULE_LABELS, modulePercent } from "@prepwise/core";
import { type AppEnv, requireAuth } from "../lib/http";

export const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use("*", requireAuth);

const MODULES = ["APTITUDE", "CODING", "DSA", "TECHNICAL", "HR"] as const;
const round1 = (n: number) => Math.round(n * 10) / 10;

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mon} ${String(d.getUTCDate()).padStart(2, "0")}, ${d.getUTCFullYear()} ${hh}:${mm}`;
}

analyticsRoutes.get("/", async (c) => {
  const db = c.env.DB;
  const userId = c.get("userId");

  const [totals, perModule, moduleTotals, progressRows, recent, days, mock] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS attempted, COALESCE(SUM(is_correct),0) AS solved, COALESCE(SUM(time_taken_seconds),0) AS secs
                FROM attempts WHERE user_id = ? AND graded = 1`).bind(userId),
    db.prepare(`SELECT c.module_type AS module, COUNT(*) AS attempted, COALESCE(SUM(a.is_correct),0) AS solved,
                       COUNT(DISTINCT CASE WHEN a.is_correct = 1 THEN a.question_id END) AS distinct_solved
                FROM attempts a JOIN questions q ON q.id = a.question_id JOIN question_categories c ON c.id = q.category_id
                WHERE a.user_id = ? AND a.graded = 1 GROUP BY c.module_type`).bind(userId),
    db.prepare(`SELECT c.module_type AS module, COUNT(*) AS total FROM questions q JOIN question_categories c ON c.id = q.category_id GROUP BY c.module_type`),
    db.prepare(`SELECT p.id, p.user_id AS userId, p.category_id AS categoryId, c.name AS categoryName, c.module_type AS moduleType,
                       p.questions_attempted AS questionsAttempted, p.questions_correct AS questionsCorrect,
                       p.accuracy, p.average_score AS averageScore, p.updated_at AS updatedAt
                FROM progress p JOIN question_categories c ON c.id = p.category_id WHERE p.user_id = ? ORDER BY p.category_id`).bind(userId),
    db.prepare(`SELECT a.id, a.is_correct AS isCorrect, a.graded, a.attempted_at AS at, q.title, c.name AS category
                FROM attempts a JOIN questions q ON q.id = a.question_id JOIN question_categories c ON c.id = q.category_id
                WHERE a.user_id = ? ORDER BY a.attempted_at DESC, a.id DESC LIMIT 5`).bind(userId),
    db.prepare(`SELECT DISTINCT substr(attempted_at, 1, 10) AS d FROM attempts WHERE user_id = ? ORDER BY d DESC LIMIT 400`).bind(userId),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(AVG(overall_score),0) AS avg FROM interviews WHERE user_id = ? AND status = 'COMPLETED'`).bind(userId),
  ]);
  const mk = (mock.results[0] ?? {}) as { n: number; avg: number };

  const t = (totals.results[0] ?? {}) as { attempted: number; solved: number; secs: number };
  const attempted = t.attempted ?? 0;
  const solved = t.solved ?? 0;

  const pm = new Map((perModule.results as { module: string; attempted: number; solved: number; distinct_solved: number }[]).map((r) => [r.module, r]));
  const mt = new Map((moduleTotals.results as { module: string; total: number }[]).map((r) => [r.module, r.total]));

  const moduleDto = (m: string) => {
    const r = pm.get(m);
    const att = r?.attempted ?? 0;
    const sol = r?.solved ?? 0;
    return {
      moduleType: m,
      moduleName: MODULE_LABELS[m],
      attempted: att,
      solved: sol,
      accuracy: att ? round1((sol / att) * 100) : 0,
      progressPercent: modulePercent(r?.distinct_solved ?? 0, mt.get(m) ?? 0),
    };
  };
  const modules = Object.fromEntries(MODULES.map((m) => [m, moduleDto(m)]));
  const withContent = MODULES.filter((m) => (mt.get(m) ?? 0) > 0);
  const overallProgress = withContent.length ? round1(withContent.reduce((s, m) => s + modules[m].progressPercent, 0) / withContent.length) : 0;

  const prog = progressRows.results as {
    categoryName: string; moduleType: string; accuracy: number; questionsAttempted: number; questionsCorrect: number;
  }[];
  const areas = classifyAreas(prog.map((p) => ({
    categoryName: p.categoryName, moduleType: p.moduleType, accuracy: p.accuracy, attempted: p.questionsAttempted, correct: p.questionsCorrect,
  })));

  const activities = (recent.results as { id: number; isCorrect: number; graded: number; at: string; title: string; category: string }[]).map((r) => ({
    id: `att-${r.id}`,
    type: "ATTEMPT",
    title: r.title,
    subtitle: r.category,
    score: !r.graded ? "Submitted" : r.isCorrect ? "Correct" : "Incorrect",
    timestamp: formatTs(r.at),
    isSuccess: !!r.graded && !!r.isCorrect,
  }));

  return c.json({
    overallProgressPercent: overallProgress,
    overallAccuracy: attempted ? round1((solved / attempted) * 100) : 0,
    totalQuestionsAttempted: attempted,
    totalQuestionsSolved: solved,
    mockInterviewsCompleted: mk.n ?? 0,
    averageMockInterviewScore: Math.round(mk.avg ?? 0),
    currentStreakDays: computeStreak((days.results as { d: string }[]).map((r) => r.d)),
    totalPracticeMinutes: Math.round((t.secs ?? 0) / 60),
    aptitudeProgress: modules.APTITUDE,
    codingProgress: modules.CODING,
    dsaProgress: modules.DSA,
    technicalProgress: modules.TECHNICAL,
    hrProgress: modules.HR,
    categoryBreakdowns: prog,
    ...areas,
    recentActivities: activities,
  });
});
