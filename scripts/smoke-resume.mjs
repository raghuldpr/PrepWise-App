// Smoke test for the resume endpoints (the analysis itself is computed in the browser).
// Usage: node scripts/smoke-resume.mjs http://localhost:8787
const BASE = process.argv[2] ?? "http://localhost:8787";
let failed = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`);
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

const validResult = (score = 80) => ({
  version: "1.0.0", score, grade: "Strong",
  target: { kind: "role", label: "Backend Developer" },
  breakdown: [
    { id: "match", label: "Fit", score: score / 2, max: 50, detail: "x" },
    { id: "rest", label: "Rest", score: score / 2, max: 50, detail: "y" },
  ],
  skills: {
    found: [{ name: "Java", category: "Programming Languages", count: 3, demonstrated: true }],
    missing: [{ label: "Docker", weight: 2 }], listedOnly: [],
  },
  sections: [{ id: "skills", present: true }],
  contact: { email: true, phone: true, github: false, linkedin: false },
  stats: { words: 300, descriptionLines: 5, quantifiedLines: 2, actionVerbLines: 3, weakPhraseLines: 0, dateRanges: 1 },
  strengths: ["ok"], weaknesses: [], suggestions: [{ priority: "low", text: "Add GitHub" }],
});
const payload = (over = {}) => ({
  filename: "asha_resume.pdf", fileType: "pdf", fileSize: 52000,
  text: "Asha Rao asha@example.com Skills Java Spring Boot MySQL Projects built things",
  targetRoleId: "backend-developer", targetRole: "Backend Developer", result: validResult(), ...over,
});

const a = new Client(), b = new Client();
const stamp = Date.now();
let r = await a.call("GET", "/api/resume");
check("resumes need a session -> 401", r.status === 401);
await a.call("POST", "/api/auth/register", { name: "Resume A", email: `resume_a_${stamp}@example.com`, password: "Sup3r-secret!" });
await b.call("POST", "/api/auth/register", { name: "Resume B", email: `resume_b_${stamp}@example.com`, password: "Sup3r-secret!" });

r = await a.call("POST", "/api/resume/analyses", payload({ result: { ...validResult(), score: 95 } }));
check("score that disagrees with the breakdown -> 400", r.status === 400, JSON.stringify(r.json));
r = await a.call("POST", "/api/resume/analyses", payload({ result: { ...validResult(), skills: { found: [{ name: "Klingon", category: "x", count: 1, demonstrated: true }], missing: [], listedOnly: [] } } }));
check("unknown skill name -> 400", r.status === 400, JSON.stringify(r.json));
r = await a.call("POST", "/api/resume/analyses", payload({ text: "short" }));
check("too-short text -> 400", r.status === 400);
r = await a.call("POST", "/api/resume/analyses", payload({ fileType: "exe" }));
check("unsupported file type -> 400", r.status === 400);
r = await a.call("POST", "/api/resume/analyses", payload({ text: "x".repeat(60_001) }));
check("oversized text -> 400", r.status === 400);

r = await a.call("POST", "/api/resume/analyses", payload({ filename: "../../evil\\name.pdf" }));
check("valid analysis saved -> 201", r.status === 201 && r.json.resumeId > 0 && r.json.analysisId > 0, JSON.stringify(r.json));
const { resumeId, analysisId } = r.json;

r = await a.call("GET", "/api/resume");
check("list shows the resume with its latest analysis", r.status === 200 && r.json.length === 1 && r.json[0].latestAnalysis?.score === 80, JSON.stringify(r.json));
check("filename path characters are neutralised", !/[\\/]/.test(r.json[0].originalFilename), r.json[0].originalFilename);

r = await a.call("GET", `/api/resume/analyses/${analysisId}`);
check("analysis detail returns the stored result", r.status === 200 && r.json.result.skills.found[0].name === "Java" && r.json.resume.id === resumeId && r.json.score === 80, JSON.stringify(r.json)?.slice(0, 200));

r = await a.call("POST", "/api/resume/analyses", payload({ resumeId, targetRole: "Full Stack Developer", targetRoleId: "full-stack-developer", result: validResult(64) }));
check("re-analysis of the same resume -> new analysis, same resume", r.status === 201 && r.json.resumeId === resumeId && r.json.analysisId !== analysisId, JSON.stringify(r.json));
const second = r.json.analysisId;
r = await a.call("GET", "/api/resume");
check("still one resume, latest analysis is the newest", r.json.length === 1 && r.json[0].latestAnalysis.id === second && r.json[0].latestAnalysis.score === 64, JSON.stringify(r.json));
r = await a.call("GET", `/api/resume/${resumeId}`);
check("resume detail lists both analyses newest first", r.status === 200 && r.json.analyses.length === 2 && r.json.analyses[0].id === second);
r = await a.call("GET", `/api/resume/${resumeId}/text`);
check("stored text can be fetched for re-analysis", r.status === 200 && /Asha Rao/.test(r.json.text));

// isolation between users
r = await b.call("GET", `/api/resume/analyses/${analysisId}`);
check("another user cannot read the analysis -> 404", r.status === 404);
r = await b.call("GET", `/api/resume/${resumeId}`);
check("another user cannot read the resume -> 404", r.status === 404);
r = await b.call("GET", `/api/resume/${resumeId}/text`);
check("another user cannot read the text -> 404", r.status === 404);
r = await b.call("POST", "/api/resume/analyses", payload({ resumeId }));
check("another user cannot attach an analysis -> 404", r.status === 404);
r = await b.call("DELETE", `/api/resume/${resumeId}`);
check("another user cannot delete it -> 404", r.status === 404);
r = await b.call("GET", "/api/resume");
check("the other user's list is empty", r.status === 200 && r.json.length === 0);

r = await a.call("DELETE", `/api/resume/${resumeId}`);
check("owner can delete", r.status === 200);
r = await a.call("GET", `/api/resume/analyses/${analysisId}`);
check("analyses are deleted with the resume", r.status === 404);
r = await a.call("GET", "/api/resume/abc");
check("non-numeric id -> 400", r.status === 400);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
