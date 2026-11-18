import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { attempts, questionOptions, questions } from "../db/schema";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

const submitSchema = z.object({
  questionId: z.number().int(),
  selectedAnswer: z.string().max(20_000).nullish(),
  timeTakenSeconds: z.number().int().min(0).max(86_400).nullish(),
  // `isCorrect` and `score` sent by old clients are ignored: grading happens on the server.
});

export const attemptRoutes = new Hono<AppEnv>();
attemptRoutes.use("*", requireAuth);

export async function refreshProgress(db: ReturnType<typeof getDb>, userId: number, categoryId: number) {
  // One atomic statement: recompute the user's totals for this category from graded attempts.
  await db.run(sql`
    INSERT INTO progress (user_id, category_id, questions_attempted, questions_correct, accuracy, average_score, updated_at)
    SELECT ${userId}, ${categoryId}, COUNT(*), COALESCE(SUM(a.is_correct), 0),
           ROUND(100.0 * COALESCE(SUM(a.is_correct), 0) / COUNT(*), 2), ROUND(AVG(a.score), 2),
           strftime('%Y-%m-%dT%H:%M:%fZ','now')
    FROM attempts a JOIN questions q ON q.id = a.question_id
    WHERE a.user_id = ${userId} AND q.category_id = ${categoryId} AND a.graded = 1
    HAVING COUNT(*) > 0
    ON CONFLICT (user_id, category_id) DO UPDATE SET
      questions_attempted = excluded.questions_attempted,
      questions_correct = excluded.questions_correct,
      accuracy = excluded.accuracy,
      average_score = excluded.average_score,
      updated_at = excluded.updated_at`);
}

attemptRoutes.post("/", validate("json", submitSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const [q] = await db.select().from(questions).where(eq(questions.id, body.questionId));
  if (!q) throw httpError(404, `Question not found with id: ${body.questionId}`);
  const selected = (body.selectedAnswer ?? "").trim();

  let graded = false;
  let isCorrect = false;
  let correctAnswer = q.expectedAnswer;

  if (q.questionType === "MCQ") {
    const opts = await db.select().from(questionOptions).where(eq(questionOptions.questionId, q.id));
    const match = opts.find((o) => String(o.id) === selected || o.optionText.trim().toLowerCase() === selected.toLowerCase());
    if (!match) throw httpError(400, "Selected answer is not one of the options for this question");
    graded = true;
    isCorrect = match.isCorrect;
    correctAnswer = opts.find((o) => o.isCorrect)?.optionText ?? q.expectedAnswer;
  }
  // Coding / descriptive answers cannot be graded yet (Iterations 5 and 6): stored, but not counted in progress.

  const score = graded && isCorrect ? 100 : 0;
  const [saved] = await db
    .insert(attempts)
    .values({
      userId,
      questionId: q.id,
      selectedAnswer: body.selectedAnswer ?? null,
      isCorrect,
      graded,
      score,
      timeTakenSeconds: body.timeTakenSeconds ?? 0,
    })
    .returning();

  let currentAccuracy: number | null = null;
  if (graded) {
    await refreshProgress(db, userId, q.categoryId);
    const row = await c.env.DB.prepare("SELECT accuracy FROM progress WHERE user_id = ? AND category_id = ?")
      .bind(userId, q.categoryId).first<{ accuracy: number }>();
    currentAccuracy = row?.accuracy ?? null;
  }

  return c.json({
    attemptId: saved.id,
    questionId: q.id,
    isCorrect,
    graded,
    score,
    selectedAnswer: saved.selectedAnswer,
    correctAnswer,
    explanation: q.explanation,
    currentAccuracy,
    attemptedAt: saved.attemptedAt,
  });
});

attemptRoutes.get("/recent", async (c) => {
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20) || 20));
  const rows = await getDb(c)
    .select({ a: attempts, title: questions.title })
    .from(attempts)
    .innerJoin(questions, eq(attempts.questionId, questions.id))
    .where(eq(attempts.userId, c.get("userId")))
    .orderBy(desc(attempts.attemptedAt), desc(attempts.id))
    .limit(limit);
  return c.json(
    rows.map(({ a, title }) => ({
      id: a.id,
      userId: a.userId,
      questionId: a.questionId,
      questionTitle: title,
      selectedAnswer: a.selectedAnswer,
      isCorrect: a.isCorrect,
      score: a.score,
      timeTakenSeconds: a.timeTakenSeconds,
      attemptedAt: a.attemptedAt,
    })),
  );
});
