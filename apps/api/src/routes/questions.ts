import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { attempts, companies, questionCategories, questionOptions, questions } from "../db/schema";
import { type AppEnv, getDb, httpError, requireAuth } from "../lib/http";

export const questionRoutes = new Hono<AppEnv>();
questionRoutes.use("*", requireAuth);

const listQuery = z.object({
  categoryId: z.coerce.number().int().optional(),
  moduleType: z.enum(["APTITUDE", "CODING", "DSA", "TECHNICAL", "HR"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  companyId: z.coerce.number().int().optional(),
  questionType: z.enum(["MCQ", "CODING", "DESCRIPTIVE", "TECHNICAL", "HR"]).optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(["id", "title", "difficulty", "createdAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

type QuestionRow = typeof questions.$inferSelect;

// Answers (expectedAnswer, explanation, option correctness) are only sent once the user has attempted
// the question, except for non-MCQ problems whose reference solution is meant to be viewable.
function toDto(
  q: QuestionRow & { categoryName: string | null; companyName: string | null },
  opts: (typeof questionOptions.$inferSelect)[],
  revealAnswers: boolean,
) {
  return {
    id: q.id,
    categoryId: q.categoryId,
    categoryName: q.categoryName,
    companyId: q.companyId,
    companyName: q.companyName,
    title: q.title,
    questionText: q.questionText,
    difficulty: q.difficulty,
    questionType: q.questionType,
    topic: q.topic,
    expectedAnswer: revealAnswers ? q.expectedAnswer : null,
    explanation: revealAnswers ? q.explanation : null,
    options: opts.map((o) => ({
      id: o.id,
      questionId: o.questionId,
      optionText: o.optionText,
      isCorrect: revealAnswers ? o.isCorrect : null,
    })),
  };
}

questionRoutes.get("/categories", async (c) => {
  const rows = await getDb(c).select().from(questionCategories).orderBy(asc(questionCategories.id));
  return c.json(rows.map((r) => ({ id: r.id, name: r.name, moduleType: r.moduleType, description: r.description })));
});

questionRoutes.get("/", async (c) => {
  const parsed = listQuery.safeParse(c.req.query());
  if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid query");
  const p = parsed.data;
  const db = getDb(c);
  const userId = c.get("userId");

  const where: SQL[] = [];
  if (p.categoryId) where.push(eq(questions.categoryId, p.categoryId));
  if (p.moduleType) where.push(eq(questionCategories.moduleType, p.moduleType));
  if (p.difficulty) where.push(eq(questions.difficulty, p.difficulty));
  if (p.companyId) where.push(eq(questions.companyId, p.companyId));
  if (p.questionType) where.push(eq(questions.questionType, p.questionType));
  const cond = where.length ? and(...where) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(questions)
    .innerJoin(questionCategories, eq(questions.categoryId, questionCategories.id))
    .where(cond);

  // Default order: questions this user has not tried yet come first, then by id.
  const order = p.sortBy
    ? [(p.sortDir === "desc" ? desc : asc)(
        { id: questions.id, title: questions.title, difficulty: questions.difficulty, createdAt: questions.createdAt }[p.sortBy],
      )]
    : [
        sql`(SELECT COUNT(*) FROM ${attempts} WHERE ${attempts.questionId} = ${questions.id} AND ${attempts.userId} = ${userId}) > 0`,
        asc(questions.id),
      ];

  const rows = await db
    .select({ q: questions, categoryName: questionCategories.name, companyName: companies.name })
    .from(questions)
    .innerJoin(questionCategories, eq(questions.categoryId, questionCategories.id))
    .leftJoin(companies, eq(questions.companyId, companies.id))
    .where(cond)
    .orderBy(...order)
    .limit(p.size)
    .offset(p.page * p.size);

  const ids = rows.map((r) => r.q.id);
  const opts = ids.length ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, ids)).orderBy(asc(questionOptions.id)) : [];
  // The list endpoint never reveals answers; GET /:id (after an attempt) or the attempt result does.
  const content = rows.map((r) =>
    toDto({ ...r.q, categoryName: r.categoryName, companyName: r.companyName }, opts.filter((o) => o.questionId === r.q.id), false),
  );
  const totalPages = Math.ceil(total / p.size);
  return c.json({
    content,
    totalElements: total,
    totalPages,
    number: p.page,
    size: p.size,
    first: p.page === 0,
    last: p.page >= totalPages - 1,
  });
});

questionRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid question id");
  const wantAnswers = c.req.query("includeAnswers") === "true";
  const db = getDb(c);
  const userId = c.get("userId");

  const [r] = await db
    .select({ q: questions, categoryName: questionCategories.name, companyName: companies.name })
    .from(questions)
    .innerJoin(questionCategories, eq(questions.categoryId, questionCategories.id))
    .leftJoin(companies, eq(questions.companyId, companies.id))
    .where(eq(questions.id, id));
  if (!r) throw httpError(404, `Question not found with id: ${id}`);

  const opts = await db.select().from(questionOptions).where(eq(questionOptions.questionId, id)).orderBy(asc(questionOptions.id));
  let reveal = false;
  if (wantAnswers) {
    if (r.q.questionType !== "MCQ") reveal = true;
    else {
      const [a] = await db.select({ id: attempts.id }).from(attempts)
        .where(and(eq(attempts.userId, userId), eq(attempts.questionId, id))).limit(1);
      reveal = !!a;
    }
  }
  return c.json(toDto({ ...r.q, categoryName: r.categoryName, companyName: r.companyName }, opts, reveal));
});
