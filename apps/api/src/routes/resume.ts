import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { RESUME_LIMITS, saveAnalysisSchema } from "@prepwise/shared";
import { resumeAnalyses, resumes } from "../db/schema";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

export const resumeRoutes = new Hono<AppEnv>();
resumeRoutes.use("*", requireAuth);

const wordCount = (t: string) => (t.match(/\S+/g) ?? []).length;

const resumeDto = (r: typeof resumes.$inferSelect) => ({
  id: r.id,
  originalFilename: r.originalFilename,
  fileType: r.fileType,
  fileSize: r.fileSize,
  wordCount: r.wordCount,
  uploadedAt: r.uploadedAt,
});

const summaryDto = (a: typeof resumeAnalyses.$inferSelect) => ({
  id: a.id,
  resumeId: a.resumeId,
  targetRole: a.targetRole,
  score: a.score,
  grade: a.grade,
  createdAt: a.createdAt,
});

// Save an analysis that was computed in the browser (the Worker's 10 ms CPU limit rules out parsing here).
resumeRoutes.post("/analyses", validate("json", saveAnalysisSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const [{ nA }] = await db.select({ nA: sql<number>`count(*)` }).from(resumeAnalyses).where(eq(resumeAnalyses.userId, userId));
  if (nA >= RESUME_LIMITS.analysesPerUser) throw httpError(400, "Analysis limit reached. Delete an old resume before analysing another.");

  let resume: typeof resumes.$inferSelect;
  if (body.resumeId) {
    const [r] = await db.select().from(resumes).where(and(eq(resumes.id, body.resumeId), eq(resumes.userId, userId)));
    if (!r) throw httpError(404, "Resume not found");
    resume = r;
  } else {
    const [{ nR }] = await db.select({ nR: sql<number>`count(*)` }).from(resumes).where(eq(resumes.userId, userId));
    if (nR >= RESUME_LIMITS.resumesPerUser) throw httpError(400, "Resume limit reached. Delete an old resume first.");
    [resume] = await db
      .insert(resumes)
      .values({
        userId,
        originalFilename: body.filename.replace(/[\\/]/g, "_"),
        fileType: body.fileType,
        fileSize: body.fileSize,
        wordCount: wordCount(body.text),
        textContent: body.text,
      })
      .returning();
  }

  const [analysis] = await db
    .insert(resumeAnalyses)
    .values({
      resumeId: resume.id,
      userId,
      targetRole: body.targetRole,
      targetRoleId: body.targetRoleId ?? null,
      jobDescription: body.jobDescription?.trim() || null,
      score: body.result.score,
      grade: body.result.grade,
      resultJson: JSON.stringify(body.result),
      analyzerVersion: body.result.version,
    })
    .returning();

  return c.json({ resumeId: resume.id, analysisId: analysis.id, createdAt: analysis.createdAt }, 201);
});

resumeRoutes.get("/", async (c) => {
  const db = getDb(c);
  const userId = c.get("userId");
  const rs = await db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.uploadedAt), desc(resumes.id));
  const as = await db.select().from(resumeAnalyses).where(eq(resumeAnalyses.userId, userId)).orderBy(desc(resumeAnalyses.createdAt), desc(resumeAnalyses.id));
  return c.json(rs.map((r) => ({ ...resumeDto(r), latestAnalysis: as.filter((a) => a.resumeId === r.id).map(summaryDto)[0] ?? null })));
});

// Registered before "/:id" so "analyses" is not read as an id.
resumeRoutes.get("/analyses/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid analysis id");
  const db = getDb(c);
  const [row] = await db
    .select({ a: resumeAnalyses, r: resumes })
    .from(resumeAnalyses)
    .innerJoin(resumes, eq(resumeAnalyses.resumeId, resumes.id))
    .where(and(eq(resumeAnalyses.id, id), eq(resumeAnalyses.userId, c.get("userId"))));
  if (!row) throw httpError(404, `Analysis not found with id: ${id}`);
  return c.json({
    ...summaryDto(row.a),
    targetRoleId: row.a.targetRoleId,
    hasJobDescription: !!row.a.jobDescription,
    analyzerVersion: row.a.analyzerVersion,
    resume: resumeDto(row.r),
    result: JSON.parse(row.a.resultJson),
  });
});

resumeRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid resume id");
  const db = getDb(c);
  const userId = c.get("userId");
  const [r] = await db.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  if (!r) throw httpError(404, `Resume not found with id: ${id}`);
  const as = await db.select().from(resumeAnalyses).where(eq(resumeAnalyses.resumeId, id)).orderBy(desc(resumeAnalyses.createdAt), desc(resumeAnalyses.id));
  return c.json({ ...resumeDto(r), analyses: as.map(summaryDto) });
});

// The extracted text, so a user can re-run the analysis for another role without uploading again.
resumeRoutes.get("/:id/text", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid resume id");
  const [r] = await getDb(c).select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, c.get("userId"))));
  if (!r) throw httpError(404, `Resume not found with id: ${id}`);
  return c.json({ id: r.id, text: r.textContent });
});

resumeRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid resume id");
  const db = getDb(c);
  const userId = c.get("userId");
  const [r] = await db.select({ id: resumes.id }).from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  if (!r) throw httpError(404, `Resume not found with id: ${id}`);
  await db.delete(resumes).where(eq(resumes.id, id)); // analyses cascade
  return c.json({ message: "Resume deleted" });
});
