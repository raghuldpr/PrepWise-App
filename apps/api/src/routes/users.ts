import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PROFILE_TEXT_FIELDS, profiles, skills, userSkills, users } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { ensureProfile, loadProfileResponse } from "../lib/profile";
import { type AppEnv, getDb, httpError, requireAuth, startSession, validate } from "../lib/http";

const levelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);
const optText = z.string().max(5000).nullish();

const updateProfileSchema = z.object({
  name: z.string().max(255).nullish(),
  graduationYear: z.number().int().min(1990).max(2100).nullish(),
  avatarUrl: z.string().max(300_000).nullish(),
  targetCompaniesData: z.string().max(20_000).nullish(),
  settingsData: z.string().max(20_000).nullish(),
  skills: z.array(z.object({ skillId: z.number().int(), proficiencyLevel: levelEnum.nullish() })).max(200).nullish(),
  ...Object.fromEntries(
    PROFILE_TEXT_FIELDS.filter((f) => !["avatarUrl", "targetCompaniesData", "settingsData"].includes(f)).map((f) => [f, optText]),
  ),
});

const settingsSchema = z.object({
  name: z.string().max(255).nullish(),
  avatarUrl: z.string().max(300_000).nullish(),
  settingsData: z.string().max(20_000).nullish(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireAuth);

userRoutes.get("/profile", async (c) => {
  const res = await loadProfileResponse(getDb(c), c.get("userId"));
  if (!res) throw httpError(404, "User not found");
  return c.json(res);
});

userRoutes.put("/profile", validate("json", updateProfileSchema), async (c) => {
  const body = c.req.valid("json") as Record<string, unknown>;
  const userId = c.get("userId");
  const db = getDb(c);

  if (typeof body.name === "string" && body.name.trim()) {
    await db.update(users).set({ name: body.name.trim(), updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
  }

  // null/undefined means "leave unchanged" (same rule as the old backend)
  const patch: Record<string, unknown> = {};
  for (const f of [...PROFILE_TEXT_FIELDS, "graduationYear"]) {
    if (body[f] !== undefined && body[f] !== null) patch[f] = body[f];
  }
  await ensureProfile(db, userId);
  if (Object.keys(patch).length) {
    await db.update(profiles).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(profiles.userId, userId));
  }

  const sk = body.skills as { skillId: number; proficiencyLevel?: string | null }[] | null | undefined;
  if (sk) {
    const valid = new Set((await db.select({ id: skills.id }).from(skills)).map((s) => s.id));
    const rows = sk.filter((s) => valid.has(s.skillId)).map((s) => ({
      userId,
      skillId: s.skillId,
      proficiencyLevel: (s.proficiencyLevel ?? "INTERMEDIATE") as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT",
    }));
    await db.delete(userSkills).where(eq(userSkills.userId, userId));
    if (rows.length) await db.insert(userSkills).values(rows).onConflictDoNothing();
  }

  return c.json(await loadProfileResponse(db, userId));
});

userRoutes.get("/settings", async (c) => {
  const db = getDb(c);
  const userId = c.get("userId");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!u) throw httpError(404, "User not found");
  return c.json({
    userId: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt,
    avatarUrl: p?.avatarUrl ?? null, settingsData: p?.settingsData ?? null,
  });
});

userRoutes.put("/settings", validate("json", settingsSchema), async (c) => {
  const { name, avatarUrl, settingsData } = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");
  if (name && name.trim()) await db.update(users).set({ name: name.trim() }).where(eq(users.id, userId));
  await ensureProfile(db, userId);
  const patch: Record<string, string> = {};
  if (avatarUrl != null) patch.avatarUrl = avatarUrl;
  if (settingsData != null) patch.settingsData = settingsData;
  if (Object.keys(patch).length) await db.update(profiles).set(patch).where(eq(profiles.userId, userId));
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return c.json({ message: "Settings updated successfully", name: u.name, avatarUrl: p?.avatarUrl ?? null, settingsData: p?.settingsData ?? null });
});

userRoutes.post("/change-password", validate("json", passwordSchema), async (c) => {
  const { currentPassword, newPassword } = c.req.valid("json");
  const db = getDb(c);
  const [u] = await db.select().from(users).where(eq(users.id, c.get("userId")));
  if (!u) throw httpError(404, "User not found");
  if (!(await verifyPassword(currentPassword, c.env.PASSWORD_PEPPER, u.passwordHash))) {
    throw httpError(400, "Current password does not match.");
  }
  const passwordHash = await hashPassword(newPassword, c.env.PASSWORD_PEPPER);
  // A new password ends every other session; this device gets a fresh one so the user stays signed in.
  const sessionVersion = u.sessionVersion + 1;
  await db.update(users).set({ passwordHash, sessionVersion, failedLogins: 0, lockedUntil: null, updatedAt: new Date().toISOString() }).where(eq(users.id, u.id));
  await startSession(c, u.id, u.email, sessionVersion);
  return c.json({ message: "Password changed successfully" });
});
