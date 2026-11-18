import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { PROFILE_TEXT_FIELDS, profiles, skills, userSkills, users } from "../db/schema";

type Db = DrizzleD1Database;

export async function loadProfileResponse(db: Db, userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return null;
  const [p] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  const skillRows = await db
    .select({
      id: skills.id,
      name: skills.name,
      category: skills.category,
      description: skills.description,
      proficiencyLevel: userSkills.proficiencyLevel,
    })
    .from(userSkills)
    .innerJoin(skills, eq(userSkills.skillId, skills.id))
    .where(eq(userSkills.userId, userId));

  const profileFields: Record<string, unknown> = {};
  for (const f of PROFILE_TEXT_FIELDS) profileFields[f] = p?.[f] ?? null;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    onboardingCompleted: u.onboardingCompleted,
    ...profileFields,
    graduationYear: p?.graduationYear ?? null,
    skills: skillRows,
    createdAt: u.createdAt,
    updatedAt: p?.updatedAt ?? u.updatedAt,
  };
}

export async function ensureProfile(db: Db, userId: number) {
  await db.insert(profiles).values({ userId }).onConflictDoNothing();
}
