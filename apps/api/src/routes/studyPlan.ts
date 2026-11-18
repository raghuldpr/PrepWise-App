import { Hono } from "hono";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { buildRoadmap, buildStudyPlan } from "@prepwise/core";
import { studyPlans } from "../db/schema";
import { loadEvidence, resolvePreferred, resolveRole } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";
import { MAX_SAVED, parseCompleted, progressSchema } from "../lib/plans";

export const studyPlanRoutes = new Hono<AppEnv>();
studyPlanRoutes.use("*", requireAuth);

const generateSchema = z.object({
  roleId: z.string().max(60).nullish(),
  targetRole: z.string().max(200).nullish(),
  stackId: z.string().max(40).nullish(),
  weeks: z.number().int().min(1).max(26),
  hoursPerWeek: z.number().int().min(2).max(60),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).nullish(),
});

const dto = (r: typeof studyPlans.$inferSelect, full = true) => ({
  id: r.id,
  title: r.title,
  targetRole: r.targetRole,
  roleId: r.roleId,
  durationWeeks: r.durationWeeks,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  completed: parseCompleted(r.completedJson),
  ...(full ? { planData: r.dataJson, data: JSON.parse(r.dataJson) } : {}),
});

studyPlanRoutes.post("/generate", validate("json", generateSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const { evidence, profileRole } = await loadEvidence(db, userId);
  const role = resolveRole(body.roleId, body.targetRole, profileRole);
  if (!role) throw httpError(400, "Unknown role");

  const roadmap = buildRoadmap({ roleId: role.id, evidence, preferred: resolvePreferred(role.id, body.stackId), hoursPerWeek: body.hoursPerWeek });
  const plan = buildStudyPlan({ roadmap, weeks: body.weeks, hoursPerWeek: body.hoursPerWeek, level: body.level ?? "Intermediate" });
  const [saved] = await db
    .insert(studyPlans)
    .values({ userId, roleId: role.id, title: plan.title, targetRole: role.title, durationWeeks: plan.durationWeeks, dataJson: JSON.stringify(plan) })
    .returning();

  const keep = await db.select({ id: studyPlans.id }).from(studyPlans)
    .where(eq(studyPlans.userId, userId)).orderBy(desc(studyPlans.updatedAt), desc(studyPlans.id)).limit(MAX_SAVED);
  await db.delete(studyPlans).where(and(eq(studyPlans.userId, userId), notInArray(studyPlans.id, keep.map((k) => k.id))));
  return c.json(dto(saved), 201);
});

studyPlanRoutes.get("/", async (c) => {
  const rows = await getDb(c).select().from(studyPlans)
    .where(eq(studyPlans.userId, c.get("userId"))).orderBy(desc(studyPlans.updatedAt), desc(studyPlans.id));
  return c.json(rows.map((r) => dto(r, false)));
});

const idParam = (c: { req: { param: (k: string) => string } }) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid id");
  return id;
};
const own = async (c: Parameters<typeof getDb>[0], id: number) => {
  const [row] = await getDb(c).select().from(studyPlans).where(and(eq(studyPlans.id, id), eq(studyPlans.userId, c.get("userId"))));
  if (!row) throw httpError(404, `Study plan not found with id: ${id}`);
  return row;
};

studyPlanRoutes.get("/:id", async (c) => c.json(dto(await own(c, idParam(c)))));

studyPlanRoutes.put("/:id/progress", validate("json", progressSchema), async (c) => {
  const row = await own(c, idParam(c));
  const { completed } = c.req.valid("json");
  const [updated] = await getDb(c).update(studyPlans)
    .set({ completedJson: JSON.stringify([...new Set(completed)]), updatedAt: new Date().toISOString() })
    .where(eq(studyPlans.id, row.id)).returning();
  return c.json({ id: updated.id, completed: parseCompleted(updated.completedJson), updatedAt: updated.updatedAt });
});

studyPlanRoutes.delete("/:id", async (c) => {
  const row = await own(c, idParam(c));
  await getDb(c).delete(studyPlans).where(eq(studyPlans.id, row.id));
  return c.json({ message: "Study plan deleted" });
});
