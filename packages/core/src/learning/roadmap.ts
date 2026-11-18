import { PROJECTS, ROLE_BY_ID, TOPIC_BY_ID, type Resource } from "@prepwise/content";
import { type Evidence, STRONG } from "./evidence";
import { analyzeGap, type GapAnalysis, orderTopics } from "./gap";
import { rankProjects } from "./projects";

export type RoadmapTopic = {
  id: string; title: string; hours: number; priority: 1 | 2 | 3; reason: string;
  outline: string[]; practice: string[]; resources: Resource[];
};
export type RoadmapPhase = {
  phaseNumber: number;
  phaseTitle: string;
  summary: string;
  hours: number;
  durationWeeks: number;
  topics: RoadmapTopic[];
  projects: { id: number; title: string; hours: number; difficulty: string }[];
  milestones: string[];
  recommendedResources: Resource[];
};
export type Roadmap = {
  version: string;
  roleId: string;
  targetRole: string;
  readiness: number;
  hoursPerWeek: number;
  totalHours: number;
  estimatedDurationWeeks: number;
  phases: RoadmapPhase[];
  gap: Pick<GapAnalysis, "existingStrengths" | "skillsToImprove" | "missingSkills">;
};
export const ROADMAP_VERSION = "1.0.0";

// Topics every placement candidate needs regardless of role (skipped when already strong).
const ESSENTIALS = ["dsa-basics", "algorithms", "problem-solving-practice", "os", "dbms", "networks", "communication"];

export type RoadmapInput = { roleId: string; evidence: Evidence; preferred?: string[]; hoursPerWeek?: number };

const weeks = (hours: number, perWeek: number) => Math.max(1, Math.ceil(hours / perWeek));

export function buildRoadmap(input: RoadmapInput): Roadmap {
  const role = ROLE_BY_ID.get(input.roleId);
  if (!role) throw new Error(`Unknown role: ${input.roleId}`);
  const H = Math.min(60, Math.max(2, Math.round(input.hoursPerWeek ?? 12)));
  const ev = input.evidence;
  const gap = analyzeGap(input.roleId, ev, input.preferred ?? []);

  const toTopic = (s: { topicId: string; priority: 1 | 2 | 3; reason: string }): RoadmapTopic => {
    const t = TOPIC_BY_ID.get(s.topicId)!;
    return { id: t.id, title: t.title, hours: t.hours, priority: s.priority, reason: s.reason, outline: t.outline, practice: t.practice, resources: t.resources };
  };

  // 1. role-specific topics (from the skill gap), minus the placement essentials which get their own phase
  const roleSteps = gap.learningOrder.filter((s) => !ESSENTIALS.includes(s.topicId));
  const byLevel = (lvl: string) => roleSteps.filter((s) => s.level === lvl).map(toTopic);

  // 2. placement essentials not already covered by the user
  const essentialWanted = ESSENTIALS.map((id) => TOPIC_BY_ID.get(id)!)
    .filter((t) => !t.covers.every((c) => (ev.get(c) ?? 0) >= STRONG))
    .map((topic) => ({ topic, priority: 2 as const, reason: "Asked in almost every campus placement process" }));
  const inRole = new Set(roleSteps.map((s) => s.topicId));
  const essentials = orderTopics(essentialWanted, ev).filter((s) => !inRole.has(s.topicId)).map(toTopic);

  // 3. projects that close the user's gaps for this role
  const missing = [...gap.items.filter((i) => i.status !== "strong").map((i) => i.skill)];
  const picks = rankProjects({ roleId: input.roleId, missingSkills: missing, limit: 2 }).map((r) => r.project);

  const phases: RoadmapPhase[] = [];
  const addPhase = (title: string, summary: string, topics: RoadmapTopic[], projects: typeof PROJECTS, milestones: string[]) => {
    const hours = topics.reduce((s, t) => s + t.hours, 0) + projects.reduce((s, p) => s + p.hours, 0);
    if (hours === 0 && milestones.length === 0) return;
    const seen = new Set<string>();
    const resources = topics.flatMap((t) => t.resources).filter((r) => !seen.has(r.url) && seen.add(r.url));
    phases.push({
      phaseNumber: phases.length + 1, phaseTitle: title, summary, hours, durationWeeks: weeks(hours, H), topics,
      projects: projects.map((p) => ({ id: p.id, title: p.title, hours: p.hours, difficulty: p.difficulty })),
      milestones, recommendedResources: resources,
    });
  };

  const checkpoint = (ts: RoadmapTopic[]) => ts.map((t) => t.practice[0]).filter(Boolean);
  const foundation = byLevel("foundation");
  const core = byLevel("core");
  const advanced = byLevel("advanced");
  if (foundation.length) addPhase("Foundations", "Basics everything else builds on.", foundation, [], checkpoint(foundation));
  if (core.length) addPhase(`Core skills for ${role.title}`, "The skills most job descriptions for this role ask for.", core, [], checkpoint(core));
  if (advanced.length) addPhase("Advanced topics and tools", "What separates a good candidate from an average one.", advanced, [], checkpoint(advanced));
  if (picks.length) {
    addPhase("Build portfolio projects", "Prove the skills with projects you can explain in an interview.", [], picks,
      [...picks.map((p) => `Finish "${p.title}" with a README, screenshots and a live link`), "Check your resume in the Resume Analyzer and add the new projects"]);
  }
  addPhase("Placement preparation", "Aptitude, data structures, core subjects and interview practice.", essentials, [], [
    "Solve 30 aptitude questions in PrepWise and review every explanation",
    ...checkpoint(essentials).slice(0, 3),
    "Complete 3 mock interviews and read each report",
  ]);

  const totalHours = phases.reduce((s, p) => s + p.hours, 0);
  return {
    version: ROADMAP_VERSION, roleId: input.roleId, targetRole: role.title, readiness: gap.readiness, hoursPerWeek: H,
    totalHours, estimatedDurationWeeks: phases.reduce((s, p) => s + p.durationWeeks, 0), phases,
    gap: { existingStrengths: gap.existingStrengths, skillsToImprove: gap.skillsToImprove, missingSkills: gap.missingSkills },
  };
}
