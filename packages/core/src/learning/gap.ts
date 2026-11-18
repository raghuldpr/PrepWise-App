import { ROLE_BY_ID, TOPIC_BY_ID, TOPIC_FOR_SKILL, type RoleProfile, type Topic } from "@prepwise/content";
import { type Evidence, STRONG } from "./evidence";

export type GapStatus = "strong" | "improve" | "missing";
export type GapItem = {
  label: string;
  weight: 1 | 2 | 3;
  status: GapStatus;
  evidence: number;
  /** The concrete skill chosen for an "any of" requirement (the one to learn or already known). */
  skill: string;
};
export type LearningStep = { topicId: string; title: string; hours: number; level: Topic["level"]; priority: 1 | 2 | 3; reason: string };

export type GapAnalysis = {
  roleId: string;
  targetRole: string;
  readiness: number; // 0..100, weighted coverage of the role's skills
  items: GapItem[];
  existingStrengths: string[];
  skillsToImprove: string[];
  missingSkills: string[];
  learningOrder: LearningStep[];
};

const LEVEL_RANK = { foundation: 0, core: 1, advanced: 2 } as const;

/** Pick the concrete skill for an any-of group: preferred stack first, then best evidence, then the first teachable one. */
function chooseOption(options: string[], ev: Evidence, preferred: string[]): string {
  const known = options.filter((o) => (ev.get(o) ?? 0) >= STRONG).sort((x, y) => (ev.get(y) ?? 0) - (ev.get(x) ?? 0));
  if (known.length) return known[0];
  const pref = options.find((o) => preferred.includes(o));
  if (pref) return pref;
  const best = [...options].sort((x, y) => (ev.get(y) ?? 0) - (ev.get(x) ?? 0))[0];
  if ((ev.get(best) ?? 0) > 0) return best;
  return options.find((o) => TOPIC_FOR_SKILL.has(o)) ?? options[0];
}

export function evaluateRole(role: RoleProfile, ev: Evidence, preferred: string[] = []): GapItem[] {
  return role.skills.map((rs) => {
    const skill = "skill" in rs ? rs.skill : chooseOption(rs.anyOf, ev, preferred);
    const label = "skill" in rs ? rs.skill : rs.label;
    // for any-of groups, evidence is the best option the user already has
    const evidence = "skill" in rs ? ev.get(rs.skill) ?? 0 : Math.max(0, ...rs.anyOf.map((o) => ev.get(o) ?? 0));
    const status: GapStatus = evidence >= STRONG ? "strong" : evidence > 0 ? "improve" : "missing";
    return { label, weight: rs.weight, status, evidence, skill };
  });
}

/** Topics to study, with prerequisites, ordered foundation -> core -> advanced and by dependency. */
export function orderTopics(wanted: { topic: Topic; priority: 1 | 2 | 3; reason: string }[], ev: Evidence): LearningStep[] {
  const picked = new Map<string, LearningStep>();
  const covered = (t: Topic) => t.covers.every((s) => (ev.get(s) ?? 0) >= STRONG);

  const add = (topic: Topic, priority: 1 | 2 | 3, reason: string) => {
    const prev = picked.get(topic.id);
    if (prev) {
      if (priority > prev.priority) prev.priority = priority;
      return;
    }
    picked.set(topic.id, { topicId: topic.id, title: topic.title, hours: topic.hours, level: topic.level, priority, reason });
    for (const pid of topic.prerequisites) {
      const pre = TOPIC_BY_ID.get(pid)!;
      if (!covered(pre)) add(pre, priority, `Prerequisite for ${topic.title}`);
    }
  };
  for (const w of wanted) add(w.topic, w.priority, w.reason);

  // dependency order (post-order DFS), then stable sort by level so foundations come first
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id) || !picked.has(id)) return;
    seen.add(id);
    for (const p of TOPIC_BY_ID.get(id)!.prerequisites) visit(p);
    order.push(id);
  };
  const byPriority = [...picked.values()].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
  for (const s of byPriority) visit(s.topicId);
  const index = new Map(order.map((id, i) => [id, i]));
  return [...picked.values()].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || index.get(a.topicId)! - index.get(b.topicId)!,
  );
}

export function analyzeGap(roleId: string, ev: Evidence, preferred: string[] = []): GapAnalysis {
  const role = ROLE_BY_ID.get(roleId);
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  const items = evaluateRole(role, ev, preferred);
  const total = items.reduce((s, i) => s + i.weight, 0);
  const got = items.reduce((s, i) => s + i.weight * Math.min(1, i.evidence), 0);

  const wanted = items
    .filter((i) => i.status !== "strong")
    .flatMap((i) => {
      const topic = TOPIC_FOR_SKILL.get(i.skill);
      if (!topic) return [];
      const why = `${i.weight === 3 ? "Core" : i.weight === 2 ? "Important" : "Useful"} for ${role.title}: ${i.label}`;
      return [{ topic, priority: i.weight, reason: why }];
    });

  // An explicitly chosen stack is learned even if another option of the same requirement is already known.
  const roleSkills = new Set(role.skills.flatMap((rs) => ("skill" in rs ? [rs.skill] : rs.anyOf)));
  const weightOf = (skill: string): 1 | 2 | 3 =>
    Math.max(1, ...role.skills.filter((rs) => ("skill" in rs ? rs.skill === skill : rs.anyOf.includes(skill))).map((rs) => rs.weight)) as 1 | 2 | 3;
  for (const pref of preferred) {
    const topic = TOPIC_FOR_SKILL.get(pref);
    if (!topic || !roleSkills.has(pref) || (ev.get(pref) ?? 0) >= STRONG) continue;
    if (wanted.some((w) => w.topic.id === topic.id)) continue;
    wanted.push({ topic, priority: weightOf(pref), reason: `Part of your chosen stack: ${pref}` });
  }

  return {
    roleId,
    targetRole: role.title,
    readiness: Math.round((got / total) * 100),
    items,
    existingStrengths: items.filter((i) => i.status === "strong").map((i) => i.label),
    skillsToImprove: items.filter((i) => i.status === "improve").map((i) => i.label),
    missingSkills: items.filter((i) => i.status === "missing").map((i) => i.label),
    learningOrder: orderTopics(wanted, ev),
  };
}
