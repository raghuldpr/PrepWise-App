import { Hono } from "hono";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { CODING_BY_ID, CODING_LANGUAGES } from "@prepwise/content";
import solutions from "../../../../packages/content/src/coding-solutions.json";
import { CODING_VERDICTS, codingSubmissions } from "../db/schema";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

// Code is run and judged in the browser (the Workers Free plan allows 10 ms of CPU per request, so the server cannot
// run it). The server therefore trusts the result only for practice tracking: it checks that the report is consistent
// with the problem (test count, verdict versus passed count) but cannot prove the code really passed.

export const codingRoutes = new Hono<AppEnv>();
codingRoutes.use("*", requireAuth);

const MAX_PER_PROBLEM = 10;
const MAX_CODE = 20000;
const SOLUTION_AFTER_ATTEMPTS = 3;

const submitSchema = z.object({
  problemId: z.string().min(1).max(80),
  language: z.enum(CODING_LANGUAGES as [string, ...string[]]),
  code: z.string().min(1, "Write some code first").max(MAX_CODE, `Keep the code under ${MAX_CODE} characters`),
  verdict: z.enum(CODING_VERDICTS),
  passed: z.number().int().min(0).max(500),
  total: z.number().int().min(1).max(500),
  timeMs: z.number().int().min(0).max(600000).default(0),
});

const problemParam = (c: { req: { param: (k: string) => string } }) => {
  const id = c.req.param("problemId");
  if (!CODING_BY_ID.has(id)) throw httpError(404, `Coding problem not found: ${id}`);
  return id;
};

async function statusFor(c: Parameters<typeof getDb>[0], problemId?: string) {
  const rows = await c.env.DB.prepare(
    `SELECT problem_id AS problemId, COUNT(*) AS attempts,
            MAX(CASE WHEN verdict = 'Accepted' THEN 1 ELSE 0 END) AS solved,
            MAX(passed) AS bestPassed, MAX(total) AS total, MAX(created_at) AS lastAt
     FROM coding_submissions WHERE user_id = ? ${problemId ? "AND problem_id = ?" : ""} GROUP BY problem_id`,
  ).bind(...(problemId ? [c.get("userId"), problemId] : [c.get("userId")])).all<{
    problemId: string; attempts: number; solved: number; bestPassed: number; total: number; lastAt: string;
  }>();
  return rows.results.map((r) => ({ ...r, solved: !!r.solved }));
}

codingRoutes.get("/status", async (c) => c.json(await statusFor(c)));

codingRoutes.post("/submissions", validate("json", submitSchema), async (c) => {
  const body = c.req.valid("json");
  const problem = CODING_BY_ID.get(body.problemId);
  if (!problem) throw httpError(404, `Coding problem not found: ${body.problemId}`);
  if (body.total !== problem.tests.length) throw httpError(400, "The test count does not match this problem; reload the page");
  if (body.passed > body.total) throw httpError(400, "passed cannot exceed total");
  const accepted = body.verdict === "Accepted";
  if (accepted !== (body.passed === body.total)) throw httpError(400, "The verdict does not match the passed count");
  if (body.verdict === "Compile Error" && body.passed !== 0) throw httpError(400, "A compile error cannot pass tests");

  const db = getDb(c);
  const userId = c.get("userId");
  await db.insert(codingSubmissions).values({
    userId, problemId: body.problemId, language: body.language as "javascript" | "python", verdict: body.verdict,
    passed: body.passed, total: body.total, timeMs: body.timeMs, code: body.code,
  });
  const keep = await db.select({ id: codingSubmissions.id }).from(codingSubmissions)
    .where(and(eq(codingSubmissions.userId, userId), eq(codingSubmissions.problemId, body.problemId)))
    .orderBy(desc(codingSubmissions.id)).limit(MAX_PER_PROBLEM);
  // Never prune the latest accepted submission, or a solved problem would silently become unsolved.
  const [lastAccepted] = await db.select({ id: codingSubmissions.id }).from(codingSubmissions)
    .where(and(eq(codingSubmissions.userId, userId), eq(codingSubmissions.problemId, body.problemId), eq(codingSubmissions.verdict, "Accepted")))
    .orderBy(desc(codingSubmissions.id)).limit(1);
  const keepIds = [...new Set([...keep.map((k) => k.id), ...(lastAccepted ? [lastAccepted.id] : [])])];
  await db.delete(codingSubmissions).where(and(
    eq(codingSubmissions.userId, userId), eq(codingSubmissions.problemId, body.problemId),
    notInArray(codingSubmissions.id, keepIds),
  ));
  const [status] = await statusFor(c, body.problemId);
  return c.json(status, 201);
});

codingRoutes.get("/submissions/:problemId", async (c) => {
  const problemId = problemParam(c);
  const rows = await getDb(c).select().from(codingSubmissions)
    .where(and(eq(codingSubmissions.userId, c.get("userId")), eq(codingSubmissions.problemId, problemId)))
    .orderBy(desc(codingSubmissions.id)).limit(MAX_PER_PROBLEM);
  return c.json(rows.map((r) => ({
    id: r.id, language: r.language, verdict: r.verdict, passed: r.passed, total: r.total, timeMs: r.timeMs, code: r.code, createdAt: r.createdAt,
  })));
});

// The reference solution is only shown after you solved the problem or tried it a few times.
codingRoutes.get("/solution/:problemId", async (c) => {
  const problemId = problemParam(c);
  const [status] = await statusFor(c, problemId);
  if (!status?.solved && (status?.attempts ?? 0) < SOLUTION_AFTER_ATTEMPTS) {
    throw httpError(403, `Try the problem first. The solution unlocks after you solve it or submit ${SOLUTION_AFTER_ATTEMPTS} attempts.`);
  }
  const s = (solutions as Record<string, { javascript: string; python: string; complexity: string; explanation: string }>)[problemId];
  return c.json(s);
});
