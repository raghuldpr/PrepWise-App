import { ROLES, SEED_SKILL_MAP, type RoleProfile } from "@prepwise/content";

export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type ProfileSkill = { name: string; level: Level };
export type ResumeSkill = { name: string; demonstrated: boolean };

/** How strongly a self-declared proficiency counts as evidence of a skill (0..1). */
export const LEVEL_EVIDENCE: Record<Level, number> = { BEGINNER: 0.4, INTERMEDIATE: 0.7, ADVANCED: 1, EXPERT: 1 };
const RESUME_DEMONSTRATED = 0.8; // shown in a project or experience
const RESUME_LISTED = 0.5; // only listed
export const STRONG = 0.7; // at or above this, a skill is considered covered

export type Evidence = Map<string, number>;

/**
 * Combines what the user declared in onboarding (27 broad skills, mapped to the finer taxonomy)
 * with what their latest resume analysis found. The higher of the two counts.
 */
export function buildEvidence(profile: ProfileSkill[], resume: ResumeSkill[] = []): Evidence {
  const ev: Evidence = new Map();
  const put = (name: string, v: number) => ev.set(name, Math.max(ev.get(name) ?? 0, v));
  for (const p of profile) for (const n of SEED_SKILL_MAP[p.name] ?? []) put(n, LEVEL_EVIDENCE[p.level] ?? 0.4);
  for (const r of resume) put(r.name, r.demonstrated ? RESUME_DEMONSTRATED : RESUME_LISTED);
  return ev;
}

/**
 * Best-effort role from free text ("Full Stack Software Engineer", "SDE", "backend"). Specific roles win over the
 * generic Software Engineer role, which is only used when nothing more specific matches.
 */
export function roleFromText(text: string | null | undefined): RoleProfile | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  const longest = (roles: RoleProfile[]) => {
    let best: { role: RoleProfile; len: number } | null = null;
    for (const role of roles) {
      for (const k of [role.title.toLowerCase(), ...role.titleKeywords]) {
        if (t.includes(k) && (!best || k.length > best.len)) best = { role, len: k.length };
      }
    }
    return best?.role ?? null;
  };
  return longest(ROLES.filter((r) => r.id !== "software-engineer")) ?? longest(ROLES.filter((r) => r.id === "software-engineer"));
}
