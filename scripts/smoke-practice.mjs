// Smoke test for the question bank, server-side grading, progress, companies and analytics.
// Usage: node scripts/smoke-practice.mjs http://localhost:8787
const BASE = process.argv[2] ?? "http://localhost:8787";
let cookie = "";
let failed = 0;

async function call(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get("set-cookie");
  if (set?.startsWith("pw_session=")) cookie = set.split(";")[0];
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failed++;
};

const email = `practice_${Date.now()}@example.com`;
let r = await call("GET", "/api/questions");
check("questions need a session -> 401", r.status === 401);
await call("POST", "/api/auth/register", { name: "Practice Tester", email, password: "Sup3r-secret!" });

r = await call("GET", "/api/questions/categories");
check("8 categories", r.status === 200 && r.json.length === 8, r.json?.length);

r = await call("GET", "/api/questions?moduleType=TECHNICAL&page=0&size=5");
check("page shape + 5 items", r.status === 200 && r.json.content.length === 5 && r.json.totalElements >= 59 && r.json.totalPages === Math.ceil(r.json.totalElements / 5), JSON.stringify({ n: r.json?.content?.length, t: r.json?.totalElements, p: r.json?.totalPages }));
const q1 = r.json.content[0];
check("list never leaks answers", r.json.content.every((q) => q.expectedAnswer === null && q.explanation === null && q.options.every((o) => o.isCorrect === null)));
check("each MCQ has 4 options", r.json.content.every((q) => q.options.length === 4));

r = await call("GET", `/api/questions/${q1.id}?includeAnswers=true`);
check("includeAnswers=true does NOT leak before an attempt", r.status === 200 && r.json.expectedAnswer === null && r.json.options.every((o) => o.isCorrect === null));

r = await call("GET", "/api/questions?difficulty=HARD&size=100");
check("difficulty filter", r.status === 200 && r.json.content.every((q) => q.difficulty === "HARD") && r.json.totalElements > 0, r.json?.totalElements);
r = await call("GET", "/api/questions?size=1000");
check("invalid size -> 400", r.status === 400);

// --- wrong answer (pick the first option that is not the correct one by trying) ---
r = await call("POST", "/api/attempts", { questionId: q1.id, selectedAnswer: "not an option" });
check("answer not in options -> 400", r.status === 400, r.status);

// forged client fields must be ignored
let wrong = null, right = null, made = 0;
for (const o of q1.options) {
  const res = await call("POST", "/api/attempts", { questionId: q1.id, selectedAnswer: String(o.id), timeTakenSeconds: 12, isCorrect: true, score: 100 }); made++;
  if (res.json.isCorrect) right = res; else wrong = wrong ?? res;
  if (right && wrong) break;
}
check("forged isCorrect/score ignored (wrong option scores 0)", wrong?.status === 200 && wrong.json.isCorrect === false && wrong.json.score === 0, JSON.stringify(wrong?.json));
check("correct option graded correct with explanation", right?.json?.isCorrect === true && right.json.score === 100 && !!right.json.explanation && !!right.json.correctAnswer, JSON.stringify(right?.json));
check("accuracy reported", typeof right?.json?.currentAccuracy === "number");

r = await call("GET", `/api/questions/${q1.id}?includeAnswers=true`);
check("answers revealed after an attempt", r.json.expectedAnswer && r.json.options.some((o) => o.isCorrect === true));

// text matching (case-insensitive) works too
const q2 = (await call("GET", "/api/questions?moduleType=APTITUDE&size=3")).json.content[0];
const full = (await call("POST", "/api/attempts", { questionId: q2.id, selectedAnswer: q2.options[0].optionText.toUpperCase() })).json;
check("option text match is case-insensitive", typeof full.isCorrect === "boolean" && full.attemptId > 0, JSON.stringify(full));

r = await call("GET", "/api/questions?moduleType=TECHNICAL&size=3");
check("attempted questions sink to the end of the default order", r.json.content[0].id !== q1.id, r.json.content.map((q) => q.id).join(","));

r = await call("GET", "/api/progress");
check("progress rows per category", r.status === 200 && r.json.length === 2 && r.json.every((p) => p.categoryName && p.moduleType), JSON.stringify(r.json));
const tech = r.json.find((p) => p.moduleType === "TECHNICAL");
check("progress counts every graded attempt (made wrong ones + 1 right)", tech.questionsAttempted === made && tech.questionsCorrect === 1 && tech.accuracy === Math.round(10000 / made) / 100, JSON.stringify(tech));
r = await call("GET", "/api/progress/weak-areas?threshold=60");
check("weak areas lists the sub-60% category", r.json.some((p) => p.categoryId === tech.categoryId), JSON.stringify(r.json));
r = await call("GET", `/api/progress/${tech.categoryId}`);
check("progress by category", r.status === 200 && r.json.categoryId === tech.categoryId);
r = await call("GET", "/api/progress/9999");
check("progress for untouched category -> 404", r.status === 404);

r = await call("GET", "/api/attempts/recent");
check("recent attempts newest first with titles", r.status === 200 && r.json.length === made + 1 && !!r.json[0].questionTitle, JSON.stringify(r.json?.length));

r = await call("GET", "/api/companies");
check("5 companies", r.status === 200 && r.json.length === 5);
r = await call("GET", "/api/companies/1/preparation");
check("company preparation counts add up", r.status === 200 && r.json.totalQuestions > 0 &&
  r.json.totalQuestions === Object.values(r.json.questionCountsByModule).reduce((a, b) => a + b, 0), JSON.stringify(r.json));
r = await call("GET", "/api/companies/999/preparation");
check("unknown company -> 404", r.status === 404);

r = await call("GET", "/api/users/analytics");
const a = r.json;
check("analytics totals", r.status === 200 && a.totalQuestionsAttempted === made + 1 && a.totalQuestionsSolved >= 1, JSON.stringify(a)?.slice(0, 200));
check("analytics streak is 1 after practising today", a.currentStreakDays === 1, a.currentStreakDays);
check("analytics has real weak/strong areas, none invented", Array.isArray(a.weakAreas) && a.weakAreas.every((w) => w.attempted > 0));
check("analytics recent activity", a.recentActivities.length === Math.min(5, made + 1) && a.recentActivities[0].type === "ATTEMPT");
check("module progress is share of questions solved", a.technicalProgress.progressPercent > 0 && a.technicalProgress.progressPercent < 10, a.technicalProgress.progressPercent);
check("empty module reports 0, not fake data", a.hrProgress.attempted === 0 && a.hrProgress.progressPercent === 0);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
