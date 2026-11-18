import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { analyzeGap, rankProjects, roleFromText } from "@prepwise/core";
import { PROJECTS, PROJECT_DOMAINS, ROLE_BY_ID, type Project } from "@prepwise/content";
import { PROJECT_STATUSES, userProjects } from "../db/schema";
import { loadEvidence } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

export const projectRoutes = new Hono<AppEnv>();
projectRoutes.use("*", requireAuth);

const BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

// Same field names the old backend used, plus structured extras (hours, languages, features ...).
const projectDto = (p: Project, extra: Record<string, unknown> = {}) => ({
  id: p.id,
  title: p.title,
  problemStatement: p.problemStatement,
  description: p.problemStatement,
  techStack: [...p.languages, ...p.skills].join(", "),
  technologyStack: [...p.languages, ...p.skills].join(", "),
  difficulty: p.difficulty,
  domain: p.domain,
  skillsCovered: p.skills.join(", "),
  placementRelevance: p.placementRelevance,
  whyItsUseful: p.whyUseful,
  roadmap: p.milestones.map((m, i) => `Phase ${i + 1}: ${m}`).join("\n"),
  developmentRoadmap: p.milestones.map((m, i) => `Phase ${i + 1}: ${m}`).join("\n"),
  futureEnhancements: p.futureEnhancements.join("; "),
  hours: p.hours,
  languages: p.languages,
  fullStack: p.fullStack,
  features: p.features,
  milestones: p.milestones,
  skills: p.skills,
  ...extra,
});

const recommendSchema = z.object({
  language: z.string().max(40).nullish(),
  domain: z.string().max(60).nullish(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullish(),
  fullStackRequired: z.boolean().nullish(),
  careerGoal: z.string().max(200).nullish(),
  roleId: z.string().max(60).nullish(),
  limit: z.number().int().min(1).max(12).nullish(),
});

projectRoutes.get("/options", (c) =>
  c.json({
    domains: PROJECT_DOMAINS,
    languages: [...new Set(PROJECTS.flatMap((p) => p.languages))].sort(),
  }),
);

projectRoutes.post("/recommend", validate("json", recommendSchema), async (c) => {
  const b = c.req.valid("json");
  const db = getDb(c);
  const { evidence, profileRole } = await loadEvidence(db, c.get("userId"));
  const role = (b.roleId && ROLE_BY_ID.get(b.roleId)) || roleFromText(b.careerGoal) || profileRole;

  // projects that teach what the user is missing for the target role rank higher
  const missing = role ? analyzeGap(role.id, evidence).items.filter((i) => i.status !== "strong").map((i) => i.skill) : [];
  const ranked = rankProjects({
    language: b.language ?? undefined, domain: b.domain ?? undefined, difficulty: b.difficulty ?? undefined,
    fullStackRequired: b.fullStackRequired ?? false, roleId: role?.id, missingSkills: missing, limit: b.limit ?? 6,
  });
  return c.json(ranked.map((r) => projectDto(r.project, { score: Math.round(r.score * 10) / 10, reasons: r.reasons })));
});

const savedDto = (r: typeof userProjects.$inferSelect) => {
  const p = BY_ID.get(r.projectId);
  return {
    id: r.id, userId: r.userId, projectId: r.projectId, status: r.status,
    startedAt: r.startedAt, completedAt: r.completedAt, createdAt: r.createdAt,
    project: p ? projectDto(p) : null,
  };
};

// "/saved" must be registered before "/:id"
projectRoutes.get("/saved", async (c) => {
  const rows = await getDb(c).select().from(userProjects)
    .where(eq(userProjects.userId, c.get("userId"))).orderBy(desc(userProjects.createdAt), desc(userProjects.id));
  return c.json(rows.map(savedDto));
});

const projectId = (c: { req: { param: (k: string) => string } }) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw httpError(400, "Invalid project id");
  if (!BY_ID.has(id)) throw httpError(404, `Project not found with id: ${id}`);
  return id;
};

projectRoutes.get("/:id", (c) => c.json(projectDto(BY_ID.get(projectId(c))!)));

projectRoutes.post("/:id/save", async (c) => {
  const id = projectId(c);
  const db = getDb(c);
  const userId = c.get("userId");
  await db.insert(userProjects).values({ userId, projectId: id }).onConflictDoNothing();
  const [row] = await db.select().from(userProjects).where(and(eq(userProjects.userId, userId), eq(userProjects.projectId, id)));
  return c.json(savedDto(row), 201);
});

projectRoutes.put("/:id/status", validate("json", z.object({ status: z.enum(PROJECT_STATUSES) })), async (c) => {
  const id = projectId(c);
  const { status } = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");
  const [row] = await db.select().from(userProjects).where(and(eq(userProjects.userId, userId), eq(userProjects.projectId, id)));
  if (!row) throw httpError(404, "Save the project first");
  const now = new Date().toISOString();
  const [updated] = await db.update(userProjects).set({
    status,
    startedAt: status === "IN_PROGRESS" || status === "COMPLETED" ? row.startedAt ?? now : null,
    completedAt: status === "COMPLETED" ? now : null,
  }).where(eq(userProjects.id, row.id)).returning();
  return c.json(savedDto(updated));
});

projectRoutes.delete("/:id/save", async (c) => {
  const id = projectId(c);
  await getDb(c).delete(userProjects).where(and(eq(userProjects.userId, c.get("userId")), eq(userProjects.projectId, id)));
  return c.json({ message: "Removed from saved projects" });
});
