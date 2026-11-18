import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profiles, skills, userSkills, users } from "../db/schema";
import { ensureProfile, loadProfileResponse } from "../lib/profile";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

const skillsSchema = z.object({
  skills: z
    .array(z.object({
      skillId: z.number().int(),
      proficiencyLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).nullish(),
    }))
    .min(1, "At least one skill must be selected")
    .max(200),
});

const goalsSchema = z.object({
  targetRole: z.string().trim().min(1, "Target role is required").max(255),
  targetCompany: z.string().max(255).nullish(),
  careerGoal: z.string().max(5000).nullish(),
  education: z.string().max(255).nullish(),
  college: z.string().max(255).nullish(),
  graduationYear: z.number().int().min(1990).max(2100).nullish(),
  bio: z.string().max(5000).nullish(),
});

export const onboardingRoutes = new Hono<AppEnv>();
onboardingRoutes.use("*", requireAuth);

onboardingRoutes.post("/skills", validate("json", skillsSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const valid = new Set((await db.select({ id: skills.id }).from(skills)).map((s) => s.id));
  const unknown = body.skills.find((s) => !valid.has(s.skillId));
  if (unknown) throw httpError(404, `Skill not found with id: ${unknown.skillId}`);

  await db.delete(userSkills).where(eq(userSkills.userId, userId));
  await db.insert(userSkills).values(
    body.skills.map((s) => ({ userId, skillId: s.skillId, proficiencyLevel: s.proficiencyLevel ?? "BEGINNER" })),
  ).onConflictDoNothing();
  return c.json({ message: "Skills saved successfully" });
});

onboardingRoutes.post("/goals", validate("json", goalsSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  await ensureProfile(db, userId);
  const patch: Record<string, unknown> = { targetRole: body.targetRole, updatedAt: new Date().toISOString() };
  for (const f of ["targetCompany", "careerGoal", "education", "college", "graduationYear", "bio"] as const) {
    if (body[f] != null) patch[f] = body[f];
  }
  await db.update(profiles).set(patch).where(eq(profiles.userId, userId));
  await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, userId));
  return c.json(await loadProfileResponse(db, userId));
});
