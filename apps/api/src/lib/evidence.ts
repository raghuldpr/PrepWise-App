import { desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { buildEvidence, type Level, roleFromText } from "@prepwise/core";
import { ROLE_BY_ID, ROLES, STACK_PRESETS, type RoleProfile } from "@prepwise/content";
import { profiles, resumeAnalyses, skills, userSkills } from "../db/schema";

/** What we know the user can do: onboarding skills plus the skills found in their latest resume analysis. */
export async function loadEvidence(db: DrizzleD1Database, userId: number) {
  const rows = await db
    .select({ name: skills.name, level: userSkills.proficiencyLevel })
    .from(userSkills)
    .innerJoin(skills, eq(userSkills.skillId, skills.id))
    .where(eq(userSkills.userId, userId));

  const [latest] = await db
    .select({ resultJson: resumeAnalyses.resultJson })
    .from(resumeAnalyses)
    .where(eq(resumeAnalyses.userId, userId))
    .orderBy(desc(resumeAnalyses.createdAt), desc(resumeAnalyses.id))
    .limit(1);

  let resume: { name: string; demonstrated: boolean }[] = [];
  if (latest) {
    try {
      const parsed = JSON.parse(latest.resultJson) as { skills?: { found?: { name: string; demonstrated: boolean }[] } };
      resume = parsed.skills?.found ?? [];
    } catch {
      /* a malformed stored result just contributes nothing */
    }
  }
  const [profile] = await db.select({ targetRole: profiles.targetRole }).from(profiles).where(eq(profiles.userId, userId));
  return {
    evidence: buildEvidence(rows.map((r) => ({ name: r.name, level: r.level as Level })), resume),
    profileRole: roleFromText(profile?.targetRole),
    usedResume: resume.length > 0,
    declaredSkills: rows.length,
  };
}

/** Resolve the role the client asked for: explicit id, then free text, then the profile's target role. */
export function resolveRole(roleId: string | null | undefined, text: string | null | undefined, profileRole: RoleProfile | null): RoleProfile | null {
  if (roleId) return ROLE_BY_ID.get(roleId) ?? null;
  return roleFromText(text) ?? profileRole ?? ROLES[0] ?? null;
}

export function resolvePreferred(roleId: string, stackId: string | null | undefined): string[] {
  if (!stackId) return [];
  return STACK_PRESETS[roleId]?.find((p) => p.id === stackId)?.skills ?? [];
}
