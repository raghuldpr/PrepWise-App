import { describe, expect, it } from "vitest";
import { PROJECTS, ROLES, TOPIC_BY_ID } from "@prepwise/content";
import {
  analyzeGap, buildEvidence, buildRoadmap, buildStudyPlan, rankProjects, roleFromText, type Level, type ProfileSkill,
} from "../index";

const skill = (name: string, level: Level = "INTERMEDIATE"): ProfileSkill => ({ name, level });
const none = buildEvidence([]);
const backendDev = buildEvidence([skill("Java", "ADVANCED"), skill("Spring Boot", "ADVANCED"), skill("MySQL"), skill("RESTful APIs"), skill("Git & GitHub"), skill("SQL"), skill("Docker & Containers", "BEGINNER")]);

describe("evidence", () => {
  it("maps onboarding skills to taxonomy names and respects levels", () => {
    const ev = buildEvidence([skill("Data Structures & Algorithms", "ADVANCED"), skill("Git & GitHub", "BEGINNER"), skill("Quantitative Aptitude")]);
    expect(ev.get("Data Structures")).toBe(1);
    expect(ev.get("Algorithms")).toBe(1);
    expect(ev.get("Git")).toBe(0.4);
    expect(ev.get("GitHub")).toBe(0.4);
    expect(ev.size).toBe(4); // aptitude has no taxonomy equivalent
  });
  it("takes the higher of profile and resume evidence", () => {
    const ev = buildEvidence([skill("Docker & Containers", "BEGINNER")], [{ name: "Docker", demonstrated: true }, { name: "Redis", demonstrated: false }]);
    expect(ev.get("Docker")).toBe(0.8);
    expect(ev.get("Redis")).toBe(0.5);
  });
  it("finds a role from free text, preferring specific roles over the generic one", () => {
    expect(roleFromText("Full Stack Software Engineer")?.id).toBe("full-stack-developer");
    expect(roleFromText("Backend Engineer")?.id).toBe("backend-developer");
    expect(roleFromText("SDE 1")?.id).toBe("software-engineer");
    expect(roleFromText("Data Scientist")?.id).toBe("data-scientist");
    expect(roleFromText("astronaut")).toBeNull();
    expect(roleFromText("")).toBeNull();
  });
});

describe("skill gap", () => {
  it("shows nothing covered for a newcomer", () => {
    const g = analyzeGap("backend-developer", none);
    expect(g.readiness).toBe(0);
    expect(g.existingStrengths).toHaveLength(0);
    expect(g.missingSkills.length).toBe(ROLES.find((r) => r.id === "backend-developer")!.skills.length);
    expect(g.learningOrder.length).toBeGreaterThan(5);
  });
  it("recognises strengths, improvement areas and missing skills", () => {
    const g = analyzeGap("backend-developer", backendDev);
    expect(g.readiness).toBeGreaterThan(45);
    expect(g.readiness).toBeLessThan(70);
    expect(g.existingStrengths).toContain("REST APIs");
    expect(g.skillsToImprove).toContain("Docker"); // beginner only
    expect(g.missingSkills).toContain("Authentication");
    expect(g.learningOrder.map((s) => s.topicId)).not.toContain("java-basics"); // already known
    expect(g.learningOrder.map((s) => s.topicId)).toContain("authentication");
  });
  it("follows the preferred stack for any-of requirements and adds prerequisites", () => {
    const g = analyzeGap("backend-developer", none, ["Python", "Django", "PostgreSQL"]);
    const ids = g.learningOrder.map((s) => s.topicId);
    expect(ids).toContain("python-basics");
    expect(ids).toContain("python-web");
    expect(ids).not.toContain("spring-boot");
    expect(ids.indexOf("python-basics")).toBeLessThan(ids.indexOf("python-web"));
  });
  it("orders foundation before core before advanced and never before a prerequisite", () => {
    for (const role of ROLES) {
      const order = analyzeGap(role.id, none).learningOrder;
      const rank = { foundation: 0, core: 1, advanced: 2 } as const;
      for (let i = 1; i < order.length; i++) expect(rank[order[i].level], role.title).toBeGreaterThanOrEqual(rank[order[i - 1].level]);
      const pos = new Map(order.map((s, i) => [s.topicId, i]));
      for (const s of order) for (const p of TOPIC_BY_ID.get(s.topicId)!.prerequisites) if (pos.has(p)) expect(pos.get(p)!, `${role.title}: ${p} before ${s.topicId}`).toBeLessThan(pos.get(s.topicId)!);
    }
  });
  it("learns an explicitly chosen stack even when another option is already known", () => {
    const g = analyzeGap("backend-developer", backendDev, ["Python", "Django", "PostgreSQL"]);
    const ids = g.learningOrder.map((s) => s.topicId);
    expect(ids).toContain("python-basics");
    expect(ids).toContain("python-web");
    expect(g.learningOrder.find((s) => s.topicId === "python-web")!.reason).toMatch(/chosen stack/);
    expect(g.readiness).toBe(analyzeGap("backend-developer", backendDev).readiness); // readiness is about what you know
  });
  it("rejects an unknown role", () => expect(() => analyzeGap("nope", none)).toThrow(/Unknown role/));
});

describe("roadmap", () => {
  const rm = buildRoadmap({ roleId: "backend-developer", evidence: none, preferred: ["Java", "Spring Boot", "MySQL"], hoursPerWeek: 12 });
  it("builds sequential phases whose hours add up", () => {
    expect(rm.phases.map((p) => p.phaseNumber)).toEqual(rm.phases.map((_, i) => i + 1));
    expect(rm.phases.reduce((s, p) => s + p.hours, 0)).toBe(rm.totalHours);
    expect(rm.estimatedDurationWeeks).toBe(rm.phases.reduce((s, p) => s + p.durationWeeks, 0));
    for (const p of rm.phases) expect(p.durationWeeks).toBe(Math.max(1, Math.ceil(p.hours / 12)));
  });
  it("teaches each topic once and ends with placement preparation", () => {
    const ids = rm.phases.flatMap((p) => p.topics.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(rm.phases[rm.phases.length - 1].phaseTitle).toBe("Placement preparation");
    expect(rm.phases.some((p) => p.projects.length > 0 && p.projects.length <= 2)).toBe(true);
  });
  it("is shorter for someone who already has the skills, and deterministic", () => {
    const strong = buildRoadmap({ roleId: "backend-developer", evidence: backendDev, preferred: ["Java"], hoursPerWeek: 12 });
    expect(strong.totalHours).toBeLessThan(rm.totalHours);
    expect(strong.readiness).toBeGreaterThan(rm.readiness);
    expect(buildRoadmap({ roleId: "backend-developer", evidence: none, preferred: ["Java", "Spring Boot", "MySQL"], hoursPerWeek: 12 })).toEqual(rm);
  });
  it("works for every role", () => {
    for (const role of ROLES) {
      const r = buildRoadmap({ roleId: role.id, evidence: none });
      expect(r.phases.length, role.title).toBeGreaterThanOrEqual(3);
      expect(r.totalHours, role.title).toBeGreaterThan(0);
    }
  });
  it("sends a user who knows everything straight to practice", () => {
    const all = buildEvidence([]);
    for (const r of ROLES) for (const t of r.skills) all.set("skill" in t ? t.skill : t.anyOf[0], 1);
    const r = buildRoadmap({ roleId: "backend-developer", evidence: all });
    expect(r.gap.missingSkills).toHaveLength(0);
    expect(r.phases.some((p) => p.phaseTitle.startsWith("Core skills"))).toBe(false);
  });
});

describe("study plan", () => {
  const rm = buildRoadmap({ roleId: "backend-developer", evidence: none, preferred: ["Java", "Spring Boot", "MySQL"], hoursPerWeek: 10 });
  it("covers the requested number of weeks and keeps weekly hours within the budget", () => {
    const plan = buildStudyPlan({ roadmap: rm, weeks: 16, hoursPerWeek: 10 });
    expect(plan.weeklySchedule).toHaveLength(16);
    for (const w of plan.weeklySchedule) {
      const hours = w.dailyTasks.reduce((s, t) => s + t.hours, 0);
      expect(hours, `week ${w.weekNumber}`).toBeLessThan(10.7);
      expect(w.dailyTasks.length).toBeGreaterThan(0);
    }
  });
  it("gives every task a unique id and ends with a mock interview and resume check", () => {
    const plan = buildStudyPlan({ roadmap: rm, weeks: 12, hoursPerWeek: 10 });
    const ids = plan.weeklySchedule.flatMap((w) => w.dailyTasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    const last = plan.weeklySchedule[plan.weeklySchedule.length - 1].dailyTasks;
    expect(last.some((t) => t.kind === "mock")).toBe(true);
    expect(last.some((t) => /Resume Analyzer/.test(t.text))).toBe(true);
  });
  it("schedules all of the roadmap's learning when there is time, and says so", () => {
    const plan = buildStudyPlan({ roadmap: rm, weeks: 26, hoursPerWeek: 40 });
    expect(plan.coverage.trimmed).toHaveLength(0);
    expect(plan.coverage.note).toMatch(/fits|more time/);
    const scheduled = plan.weeklySchedule.flatMap((w) => w.dailyTasks).filter((t) => t.kind === "learn" || t.kind === "project").reduce((s, t) => s + t.hours, 0);
    expect(Math.abs(scheduled - plan.coverage.plannedLearningHours)).toBeLessThan(plan.weeklySchedule.length); // rounding only
  });
  it("is honest when the deadline is too short: it drops low-priority items and lists them", () => {
    const plan = buildStudyPlan({ roadmap: rm, weeks: 3, hoursPerWeek: 8 });
    expect(plan.coverage.trimmed.length).toBeGreaterThan(0);
    expect(plan.coverage.note).toMatch(/needs about/);
    expect(plan.coverage.plannedLearningHours).toBeLessThanOrEqual(3 * Math.round(8 * 0.65));
    expect(plan.coverage.neededWeeks).toBeGreaterThan(3);
    expect(plan.coverage.neededHoursPerWeek).toBeGreaterThan(8);
    expect(plan.coverage.note).toMatch(/needs about/);
  });
  it("when trimming, keeps the core of the roadmap in order and drops projects and advanced topics first", () => {
    const plan = buildStudyPlan({ roadmap: rm, weeks: 12, hoursPerWeek: 10 });
    const text = plan.weeklySchedule.flatMap((w) => w.dailyTasks.map((t) => t.text)).join(" | ");
    expect(text).toMatch(/Java fundamentals/);
    expect(plan.coverage.trimmed.some((t) => t.startsWith("Project:"))).toBe(true);
    expect(plan.coverage.trimmed).toContain("Microservices and messaging");
    expect(plan.coverage.trimmed).not.toContain("Java fundamentals");
  });
  it("uses nearly all of the available learning time when it has to trim", () => {
    for (const [weeks, hpw] of [[8, 10], [12, 10], [6, 15], [10, 6]] as const) {
      const plan = buildStudyPlan({ roadmap: rm, weeks, hoursPerWeek: hpw });
      const capacity = weeks * Math.round(hpw * 0.65);
      expect(plan.coverage.plannedLearningHours, "within capacity").toBeLessThanOrEqual(capacity);
      expect(plan.coverage.plannedLearningHours, "uses at least 85% of capacity").toBeGreaterThanOrEqual(capacity * 0.85);
    }
  });
  it("never repeats the same task twice in one week", () => {
    const plan = buildStudyPlan({ roadmap: rm, weeks: 26, hoursPerWeek: 40 });
    for (const w of plan.weeklySchedule) {
      const texts = w.dailyTasks.map((t) => t.text);
      expect(new Set(texts).size, `week ${w.weekNumber}: ${texts.join(" || ")}`).toBe(texts.length);
    }
  });
  it("makes a beginner's plan longer than an advanced learner's", () => {
    const b = buildStudyPlan({ roadmap: rm, weeks: 26, hoursPerWeek: 10, level: "Beginner" });
    const a = buildStudyPlan({ roadmap: rm, weeks: 26, hoursPerWeek: 10, level: "Advanced" });
    expect(b.coverage.plannedLearningHours).toBeGreaterThan(a.coverage.plannedLearningHours);
  });
  it("handles extreme inputs", () => {
    expect(buildStudyPlan({ roadmap: rm, weeks: 0, hoursPerWeek: 1 }).weeklySchedule).toHaveLength(1);
    expect(buildStudyPlan({ roadmap: rm, weeks: 100, hoursPerWeek: 500 }).durationWeeks).toBe(26);
  });
});

describe("project ranking", () => {
  it("puts a matching language and domain first, with reasons", () => {
    const r = rankProjects({ language: "Python", domain: "AI / Machine Learning", difficulty: "MEDIUM", limit: 3 });
    expect(r[0].project.domain).toBe("AI / Machine Learning");
    expect(r[0].project.languages).toContain("Python");
    expect(r[0].reasons.join(" ")).toMatch(/Python/);
  });
  it("treats full-stack as a hard filter even with a strong language match", () => {
    const r = rankProjects({ language: "Java", fullStackRequired: true, limit: 20 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.project.fullStack)).toBe(true);
  });
  it("requires full-stack projects when asked", () => {
    const r = rankProjects({ fullStackRequired: true, limit: 5 });
    expect(r.every((x) => x.project.fullStack)).toBe(true);
  });
  it("prefers projects that teach missing skills", () => {
    const r = rankProjects({ roleId: "devops-engineer", missingSkills: ["Terraform", "Monitoring"], limit: 1 });
    expect(r[0].project.skills).toContain("Terraform");
    expect(r[0].reasons.join(" ")).toMatch(/missing/);
  });
  it("is deterministic, respects the limit, and never invents projects", () => {
    expect(rankProjects({ limit: 4 })).toHaveLength(4);
    expect(rankProjects({ language: "Java" })).toEqual(rankProjects({ language: "Java" }));
    for (const x of rankProjects({ limit: 100 })) expect(PROJECTS).toContain(x.project);
  });
});
