import { Hono } from "hono";
import { and, asc, eq, lt } from "drizzle-orm";
import { progress, questionCategories } from "../db/schema";
import { type AppEnv, getDb, httpError, requireAuth } from "../lib/http";

export const progressRoutes = new Hono<AppEnv>();
progressRoutes.use("*", requireAuth);

const select = {
  id: progress.id,
  userId: progress.userId,
  categoryId: progress.categoryId,
  categoryName: questionCategories.name,
  moduleType: questionCategories.moduleType,
  questionsAttempted: progress.questionsAttempted,
  questionsCorrect: progress.questionsCorrect,
  accuracy: progress.accuracy,
  averageScore: progress.averageScore,
  updatedAt: progress.updatedAt,
};

progressRoutes.get("/", async (c) => {
  const rows = await getDb(c).select(select).from(progress)
    .innerJoin(questionCategories, eq(progress.categoryId, questionCategories.id))
    .where(eq(progress.userId, c.get("userId"))).orderBy(asc(progress.categoryId));
  return c.json(rows);
});

// Must be registered before "/:categoryId"
progressRoutes.get("/weak-areas", async (c) => {
  const t = Number(c.req.query("threshold") ?? 60);
  const threshold = Number.isFinite(t) ? t : 60;
  const rows = await getDb(c).select(select).from(progress)
    .innerJoin(questionCategories, eq(progress.categoryId, questionCategories.id))
    .where(and(eq(progress.userId, c.get("userId")), lt(progress.accuracy, threshold)))
    .orderBy(asc(progress.accuracy));
  return c.json(rows);
});

progressRoutes.get("/:categoryId", async (c) => {
  const categoryId = Number(c.req.param("categoryId"));
  if (!Number.isInteger(categoryId)) throw httpError(400, "Invalid category id");
  const [row] = await getDb(c).select(select).from(progress)
    .innerJoin(questionCategories, eq(progress.categoryId, questionCategories.id))
    .where(and(eq(progress.userId, c.get("userId")), eq(progress.categoryId, categoryId)));
  if (!row) throw httpError(404, `Progress record not found for category id: ${categoryId}`);
  return c.json(row);
});
