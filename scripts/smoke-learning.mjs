// Smoke test for skill gap, roadmap, study plan and projects.
// Usage: node scripts/smoke-learning.mjs http://localhost:8787
const BASE = process.argv[2] ?? "http://localhost:8787";
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + String(extra).slice(0, 300)}`);
  if (!cond) failed++;
};
class Client {
  cookie = "";
  async call(method, path, body) {
    const r = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.get("set-cookie");
    if (set?.startsWith("pw_session=")) this.cookie = set.split(";")[0];
    let json = null;
    try { json = await r.json(); } catch {}
    return { status: r.status, json };
  }
}

const a = new Client(), b = new Client();
const stamp = Date.now();
let r = await a.call("POST", "/api/skills/analyze", { roleId: "backend-developer" });
check("needs a session -> 401", r.status === 401);
await a.call("POST", "/api/auth/register", { name: "Learner A", email: `learn_a_${stamp}@example.com`, password: "Sup3r-secret!" });
await b.call("POST", "/api/auth/register", { name: "Learner B", email: `learn_b_${stamp}@example.com`, password: "Sup3r-secret!" });

// ---------------------------------------------------------------- skill gap
r = await a.call("POST", "/api/skills/analyze", { roleId: "backend-developer" });
check("gap for a newcomer: nothing covered", r.status === 200 && r.json.readiness === 0 && r.json.existingStrengths.length === 0 && r.json.learningOrder.length > 5, JSON.stringify(r.json)?.slice(0, 200));
const emptyReadiness = r.json.readiness;

const all = (await a.call("GET", "/api/skills")).json;
const idOf = (n) => all.find((s) => s.name === n).id;
r = await a.call("POST", "/api/onboarding/skills", { skills: [
  { skillId: idOf("Java"), proficiencyLevel: "ADVANCED" }, { skillId: idOf("Spring Boot"), proficiencyLevel: "ADVANCED" },
  { skillId: idOf("MySQL"), proficiencyLevel: "INTERMEDIATE" }, { skillId: idOf("RESTful APIs"), proficiencyLevel: "INTERMEDIATE" },
  { skillId: idOf("Docker & Containers"), proficiencyLevel: "BEGINNER" }, { skillId: idOf("Git & GitHub"), proficiencyLevel: "ADVANCED" },
] });
check("onboarding skills saved", r.status === 200);

r = await a.call("POST", "/api/skills/analyze", { roleId: "backend-developer" });
check("gap now reflects the user's skills", r.status === 200 && r.json.readiness > emptyReadiness && r.json.existingStrengths.includes("REST APIs") && r.json.skillsToImprove.includes("Docker"), JSON.stringify(r.json)?.slice(0, 300));
check("already-known topics are not recommended", !r.json.learningOrder.some((s) => s.topicId === "java-basics") && r.json.learningOrder.some((s) => s.topicId === "authentication"));
check("old-style fields are still present", Array.isArray(r.json.missingSkills) && Array.isArray(r.json.recommendedLearningOrder ?? r.json.learningOrder) && !!r.json.targetRole && r.json.id > 0);
r = await a.call("GET", "/api/skills/gap-analysis");
check("latest analysis can be fetched", r.status === 200 && r.json.roleId === "backend-developer");
r = await b.call("GET", "/api/skills/gap-analysis");
check("another user has none -> 404", r.status === 404);
r = await a.call("POST", "/api/skills/analyze", { targetRole: "Full Stack Software Engineer" });
check("free-text role resolves to the specific role", r.status === 200 && r.json.roleId === "full-stack-developer", r.json?.roleId);
r = await a.call("POST", "/api/skills/analyze", { roleId: "astronaut" });
check("unknown role id -> 400", r.status === 400);
r = await a.call("POST", "/api/skills/analyze", { roleId: "backend-developer", stackId: "python" });
check("stack preference changes the learning path", r.status === 200 && r.json.learningOrder.some((s) => s.topicId === "python-web"), r.json?.learningOrder?.map((s) => s.topicId).join(","));

// ---------------------------------------------------------------- roadmap
r = await a.call("POST", "/api/roadmap/generate", { roleId: "backend-developer", hoursPerWeek: 12 });
check("roadmap generated", r.status === 201 && r.json.id > 0 && r.json.data.phases.length >= 3, JSON.stringify(r.json)?.slice(0, 200));
const rid = r.json.id;
check("roadmap has the compat string and structured data", typeof r.json.roadmapData === "string" && JSON.parse(r.json.roadmapData).targetRole === "Backend Developer");
check("roadmap uses known topics only once", (() => { const ids = r.json.data.phases.flatMap((p) => p.topics.map((t) => t.id)); return new Set(ids).size === ids.length; })());
check("roadmap respects the declared skills (no Java basics)", !r.json.data.phases.flatMap((p) => p.topics.map((t) => t.id)).includes("java-basics"));
r = await a.call("GET", "/api/roadmap");
check("roadmap list is summaries", r.status === 200 && r.json.length === 1 && !("data" in r.json[0]));
r = await a.call("PUT", `/api/roadmap/${rid}/progress`, { completed: ["spring-boot", "docker", "spring-boot"] });
check("progress saved and de-duplicated", r.status === 200 && r.json.completed.length === 2, JSON.stringify(r.json));
r = await a.call("PUT", `/api/roadmap/${rid}/progress`, { completed: ["<script>"] });
check("progress rejects odd ids -> 400", r.status === 400);
r = await a.call("GET", `/api/roadmap/${rid}`);
check("progress is returned with the roadmap", r.status === 200 && r.json.completed.includes("docker"));
r = await b.call("GET", `/api/roadmap/${rid}`);
check("another user cannot read it -> 404", r.status === 404);
r = await b.call("PUT", `/api/roadmap/${rid}/progress`, { completed: [] });
check("another user cannot change it -> 404", r.status === 404);
r = await b.call("DELETE", `/api/roadmap/${rid}`);
check("another user cannot delete it -> 404", r.status === 404);
r = await a.call("POST", "/api/roadmap/generate", { roleId: "nope" });
check("unknown role -> 400", r.status === 400);

// ---------------------------------------------------------------- study plan
r = await a.call("POST", "/api/study-plan/generate", { roleId: "backend-developer", weeks: 8, hoursPerWeek: 10, level: "Intermediate" });
check("study plan generated", r.status === 201 && r.json.data.weeklySchedule.length === 8 && r.json.durationWeeks === 8, JSON.stringify(r.json)?.slice(0, 200));
const pid = r.json.id;
check("plan states honestly whether it fits", typeof r.json.data.coverage.note === "string" && r.json.data.coverage.note.length > 10, r.json?.data?.coverage?.note);
check("every week has tasks with unique ids", (() => { const ids = r.json.data.weeklySchedule.flatMap((w) => w.dailyTasks.map((t) => t.id)); return ids.length > 20 && new Set(ids).size === ids.length; })());
r = await a.call("POST", "/api/study-plan/generate", { roleId: "backend-developer", weeks: 0, hoursPerWeek: 10 });
check("invalid weeks -> 400", r.status === 400);
r = await a.call("POST", "/api/study-plan/generate", { roleId: "backend-developer", weeks: 8, hoursPerWeek: 100 });
check("invalid hours -> 400", r.status === 400);
r = await a.call("PUT", `/api/study-plan/${pid}/progress`, { completed: ["w1-t1", "w1-t2"] });
check("task progress saved", r.status === 200 && r.json.completed.length === 2);
r = await a.call("GET", "/api/study-plan");
check("plan list is summaries", r.status === 200 && r.json.length === 1 && r.json[0].durationWeeks === 8 && !("data" in r.json[0]));
r = await b.call("GET", `/api/study-plan/${pid}`);
check("another user cannot read the plan -> 404", r.status === 404);

// ---------------------------------------------------------------- projects
r = await a.call("POST", "/api/projects/recommend", { language: "Java", domain: "Web Development", difficulty: "MEDIUM", fullStackRequired: true, careerGoal: "Backend Developer" });
check("recommendations returned with reasons", r.status === 200 && r.json.length > 0 && r.json[0].reasons.length > 0 && r.json.every((p) => p.fullStack), JSON.stringify(r.json?.[0])?.slice(0, 200));
check("compat string fields present", typeof r.json[0].techStack === "string" && typeof r.json[0].roadmap === "string" && /Phase 1/.test(r.json[0].roadmap));
const pj = r.json[0].id;
r = await a.call("GET", `/api/projects/${pj}`);
check("project detail", r.status === 200 && r.json.id === pj && r.json.milestones.length === 4);
r = await a.call("GET", "/api/projects/9999");
check("unknown project -> 404", r.status === 404);
r = await a.call("GET", "/api/projects/saved");
check("nothing saved yet", r.status === 200 && r.json.length === 0);
r = await a.call("POST", `/api/projects/${pj}/save`);
check("save a project", r.status === 201 && r.json.status === "SAVED" && r.json.project.id === pj);
r = await a.call("POST", `/api/projects/${pj}/save`);
check("saving twice is idempotent", r.status === 201);
r = await a.call("GET", "/api/projects/saved");
check("saved list has exactly one", r.json.length === 1);
r = await a.call("PUT", `/api/projects/${pj}/status`, { status: "IN_PROGRESS" });
check("status IN_PROGRESS sets startedAt", r.status === 200 && r.json.status === "IN_PROGRESS" && !!r.json.startedAt && !r.json.completedAt);
r = await a.call("PUT", `/api/projects/${pj}/status`, { status: "COMPLETED" });
check("status COMPLETED sets completedAt", r.json.status === "COMPLETED" && !!r.json.completedAt);
r = await a.call("PUT", `/api/projects/${pj}/status`, { status: "FINISHED" });
check("invalid status -> 400", r.status === 400);
r = await b.call("PUT", `/api/projects/${pj}/status`, { status: "PLANNED" });
check("cannot change status of a project you have not saved -> 404", r.status === 404);
r = await b.call("GET", "/api/projects/saved");
check("saved lists are per user", r.json.length === 0);
r = await a.call("DELETE", `/api/projects/${pj}/save`);
r = await a.call("GET", "/api/projects/saved");
check("unsave works", r.json.length === 0);
r = await a.call("GET", "/api/projects/options");
check("filter options are available", r.status === 200 && r.json.domains.length > 3 && r.json.languages.includes("Python"));

// ---------------------------------------------------------------- cleanup of what the user owns
r = await a.call("DELETE", `/api/roadmap/${rid}`);
check("owner can delete the roadmap", r.status === 200);
r = await a.call("DELETE", `/api/study-plan/${pid}`);
check("owner can delete the plan", r.status === 200);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
