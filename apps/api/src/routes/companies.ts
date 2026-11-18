import { Hono } from "hono";
import { asc, eq, sql } from "drizzle-orm";
import { companies, questionCategories, questions } from "../db/schema";
import { type AppEnv, getDb, httpError, requireAuth } from "../lib/http";

export const companyRoutes = new Hono<AppEnv>();
companyRoutes.use("*", requireAuth);

const dto = (c: typeof companies.$inferSelect) => ({
  id: c.id, name: c.name, description: c.description, website: c.website, industry: c.industry,
});

companyRoutes.get("/", async (c) => {
  const rows = await getDb(c).select().from(companies).orderBy(asc(companies.id));
  return c.json(rows.map(dto));
});

companyRoutes.get("/:id/preparation", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid company id");
  const db = getDb(c);
  const [company] = await db.select().from(companies).where(eq(companies.id, id));
  if (!company) throw httpError(404, `Company not found with id: ${id}`);

  const counts = await db
    .select({ moduleType: questionCategories.moduleType, n: sql<number>`count(*)` })
    .from(questions)
    .innerJoin(questionCategories, eq(questions.categoryId, questionCategories.id))
    .where(eq(questions.companyId, id))
    .groupBy(questionCategories.moduleType);

  const by: Record<string, number> = { APTITUDE: 0, CODING: 0, DSA: 0, TECHNICAL: 0, HR: 0 };
  for (const r of counts) by[r.moduleType] = r.n;
  return c.json({
    company: dto(company),
    totalQuestions: Object.values(by).reduce((a, b) => a + b, 0),
    aptitudeQuestionsCount: by.APTITUDE,
    codingQuestionsCount: by.CODING,
    dsaQuestionsCount: by.DSA,
    technicalQuestionsCount: by.TECHNICAL,
    hrQuestionsCount: by.HR,
    questionCountsByModule: by,
  });
});
