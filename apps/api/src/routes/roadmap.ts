import { Hono } from "hono";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { buildRoadmap } from "@prepwise/core";
import { learningRoadmaps } from "../db/schema";
import { loadEvidence, resolvePreferred, resolveRole } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";
import { MAX_SAVED, parseCompleted, progressSchema } from "../lib/plans";

export const roadmapRoutes = new Hono<AppEnv>();
roadmapRoutes.use("*", requireAuth);

const generateSchema = z.object({
  roleId: z.string().max(60).nullish(),
  targetRole: z.string().max(200).nullish(),
  stackId: z.string().max(40).nullish(),
  hoursPerWeek: z.number().int().min(2).max(60).nullish(),
});

const dto = (r: typeof learningRoadmaps.$inferSelect, full = true) => ({
  id: r.id,
  targetRole: r.targetRole,
  roleId: r.roleId,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  completed: parseCompleted(r.completedJson),
  ...(full ? { roadmapData: r.dataJson, data: JSON.parse(r.dataJson) } : {}),
});

roadmapRoutes.post("/generate", validate("json", generateSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const { evidence, profileRole } = await loadEvidence(db, userId);
  const role = resolveRole(body.roleId, body.targetRole, profileRole);
  if (!role) throw httpError(400, "Unknown role");

  const roadmap = buildRoadmap({
    roleId: role.id, evidence, preferred: resolvePreferred(role.id, body.stackId), hoursPerWeek: body.hoursPerWeek ?? 12,
  });
  const [saved] = await db
    .insert(learningRoadmaps)
    .values({ userId, roleId: role.id, targetRole: role.title, dataJson: JSON.stringify(roadmap) })
    .returning();

  // keep only the newest MAX_SAVED roadmaps per user
  const keep = await db.select({ id: learningRoadmaps.id }).from(learningRoadmaps)
    .where(eq(learningRoadmaps.userId, userId)).orderBy(desc(learningRoadmaps.updatedAt), desc(learningRoadmaps.id)).limit(MAX_SAVED);
  await db.delete(learningRoadmaps).where(and(eq(learningRoadmaps.userId, userId), notInArray(learningRoadmaps.id, keep.map((k) => k.id))));
  return c.json(dto(saved), 201);
});

roadmapRoutes.get("/", async (c) => {
  const rows = await getDb(c).select().from(learningRoadmaps)
    .where(eq(learningRoadmaps.userId, c.get("userId"))).orderBy(desc(learningRoadmaps.updatedAt), desc(learningRoadmaps.id));
  return c.json(rows.map((r) => dto(r, false)));
});

const ownRoadmap = async (c: Parameters<typeof getDb>[0], id: number) => {
  const [row] = await getDb(c).select().from(learningRoadmaps)
    .where(and(eq(learningRoadmaps.id, id), eq(learningRoadmaps.userId, c.get("userId"))));
  if (!row) throw httpError(404, `Roadmap not found with id: ${id}`);
  return row;
};
const idParam = (c: { req: { param: (k: string) => string } }) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid id");
  return id;
};

roadmapRoutes.get("/:id", async (c) => c.json(dto(await ownRoadmap(c, idParam(c)))));

roadmapRoutes.put("/:id/progress", validate("json", progressSchema), async (c) => {
  const row = await ownRoadmap(c, idParam(c));
  const { completed } = c.req.valid("json");
  const [updated] = await getDb(c).update(learningRoadmaps)
    .set({ completedJson: JSON.stringify([...new Set(completed)]), updatedAt: new Date().toISOString() })
    .where(eq(learningRoadmaps.id, row.id)).returning();
  return c.json({ id: updated.id, completed: parseCompleted(updated.completedJson), updatedAt: updated.updatedAt });
});

roadmapRoutes.delete("/:id", async (c) => {
  const row = await ownRoadmap(c, idParam(c));
  await getDb(c).delete(learningRoadmaps).where(eq(learningRoadmaps.id, row.id));
  return c.json({ message: "Roadmap deleted" });
});
