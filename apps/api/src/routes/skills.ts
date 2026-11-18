import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { analyzeGap } from "@prepwise/core";
import { skillGapAnalyses, skills } from "../db/schema";
import { loadEvidence, resolvePreferred, resolveRole } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

export const skillRoutes = new Hono<AppEnv>();
skillRoutes.use("*", requireAuth);

skillRoutes.get("/", async (c) => {
  const rows = await getDb(c).select().from(skills).orderBy(asc(skills.category), asc(skills.name));
  return c.json(rows);
});

const analyzeSchema = z.object({
  roleId: z.string().max(60).nullish(),
  targetRole: z.string().max(200).nullish(), // free text from older clients
  stackId: z.string().max(40).nullish(),
});

function toResponse(row: typeof skillGapAnalyses.$inferSelect) {
  const r = JSON.parse(row.resultJson);
  return { id: row.id, createdAt: row.createdAt, ...r };
}

// Deterministic skill-gap analysis: the user's skills against a role profile. No AI involved.
skillRoutes.post("/analyze", validate("json", analyzeSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const { evidence, profileRole, usedResume, declaredSkills } = await loadEvidence(db, userId);
  const role = resolveRole(body.roleId, body.targetRole, profileRole);
  if (!role) throw httpError(400, "Unknown role");

  const gap = analyzeGap(role.id, evidence, resolvePreferred(role.id, body.stackId));
  const result = { ...gap, basedOn: { declaredSkills, usedResume } };
  const [saved] = await db
    .insert(skillGapAnalyses)
    .values({ userId, roleId: role.id, targetRole: role.title, readiness: gap.readiness, resultJson: JSON.stringify(result) })
    .returning();
  return c.json(toResponse(saved));
});

skillRoutes.get("/gap-analysis", async (c) => {
  const [row] = await getDb(c)
    .select()
    .from(skillGapAnalyses)
    .where(eq(skillGapAnalyses.userId, c.get("userId")))
    .orderBy(desc(skillGapAnalyses.createdAt), desc(skillGapAnalyses.id))
    .limit(1);
  if (!row) throw httpError(404, "No skill-gap analysis yet");
  return c.json(toResponse(row));
});
