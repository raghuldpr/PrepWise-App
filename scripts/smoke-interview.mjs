// Smoke test for the mock interview API (question bank, adaptive selection, scoring, reports, history).
// Usage: node scripts/smoke-interview.mjs http://localhost:8787
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
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  }
}

const a = new Client(), b = new Client();
const stamp = Date.now();
check("options need a session -> 401", (await a.call("GET", "/api/interviews/options")).status === 401);
check("history needs a session -> 401", (await a.call("GET", "/api/interviews/history")).status === 401);
await a.call("POST", "/api/auth/register", { name: "Interviewee A", email: `iv_a_${stamp}@example.com`, password: "Sup3r-secret!" });
await b.call("POST", "/api/auth/register", { name: "Interviewee B", email: `iv_b_${stamp}@example.com`, password: "Sup3r-secret!" });

let r = await a.call("GET", "/api/interviews/options");
check("options list types, roles and limits", r.status === 200 && r.json.types.length === 3 && r.json.roles.length >= 9 && r.json.minQuestions === 3 && r.json.maxQuestions === 10, r.text);
const hrAvailable = r.json.types.find((t) => t.id === "HR").available;
check("bank sizes are reported", r.json.types.find((t) => t.id === "TECHNICAL").available >= 60 && hrAvailable >= 12, r.text);

// ------------------------------------------------------------ validation
const base = { interviewType: "TECHNICAL", difficulty: "MEDIUM", numberOfQuestions: 4, roleId: "backend-developer" };
check("too few questions -> 400", (await a.call("POST", "/api/interviews", { ...base, numberOfQuestions: 2 })).status === 400);
check("too many questions -> 400", (await a.call("POST", "/api/interviews", { ...base, numberOfQuestions: 11 })).status === 400);
check("unknown type -> 400", (await a.call("POST", "/api/interviews", { ...base, interviewType: "CODING" })).status === 400);
check("unknown difficulty -> 400", (await a.call("POST", "/api/interviews", { ...base, difficulty: "EXTREME" })).status === 400);
check("unknown role -> 400", (await a.call("POST", "/api/interviews", { ...base, roleId: "astronaut" })).status === 400);

// ------------------------------------------------------------ a technical interview
r = await a.call("POST", "/api/interviews", { ...base, companyName: "Acme" });
check("create -> 201 with the first question", r.status === 201 && r.json.status === "IN_PROGRESS" && r.json.currentQuestion?.questionText && r.json.questionCount === 4, r.text);
check("the question does not leak concepts or the model answer", !/concepts|modelAnswer|terms|\"tip\"/.test(r.text), r.text);
const iv = r.json;
const first = iv.currentQuestion;
check("first question is technical, numbered 1 of 4", first.kind === "TECHNICAL" && first.questionOrder === 1 && first.totalQuestions === 4 && first.ideaCount >= 3, JSON.stringify(first));

r = await a.call("GET", `/api/interviews/${iv.id}`);
check("reloading shows the same question", r.status === 200 && r.json.currentQuestion.id === first.id, r.text);

check("answering a different question -> 409", (await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: "oop-pillars-nope", answerText: "x y z" })).status === 409);
check("empty answer without skip -> 400", (await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: first.id, answerText: "   " })).status === 400);
check("over-long answer -> 400", (await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: first.id, answerText: "word ".repeat(1000) })).status === 400);
check("report not ready yet -> 404", (await a.call("GET", `/api/interviews/${iv.id}/report`)).status === 404);
check("cannot finish with zero answers -> 400", (await a.call("POST", `/api/interviews/${iv.id}/complete`)).status === 400);

check("another user cannot read it -> 404", (await b.call("GET", `/api/interviews/${iv.id}`)).status === 404);
check("another user cannot answer it -> 404", (await b.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: first.id, answerText: "a b c d" })).status === 404);

const vague = "I think this is something about how computers work and it is quite important in general for software";
const ids = [first.id];
r = await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: first.id, answerText: vague, secondsTaken: 30 });
check("answer 1 accepted, next question returned", r.status === 200 && r.json.done === false && r.json.answeredCount === 1 && r.json.nextQuestion?.questionOrder === 2, r.text);
check("no score is revealed during the interview", !/score|verdict/i.test(r.text), r.text);
let q = r.json.nextQuestion;
ids.push(q.id);
r = await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: q.id, skipped: true });
check("skip is accepted without text", r.status === 200 && r.json.answeredCount === 2 && r.json.nextQuestion, r.text);
q = r.json.nextQuestion; ids.push(q.id);
r = await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: q.id, answerText: vague + ". For example a bank has many customers and each one has an account.", secondsTaken: 50 });
q = r.json.nextQuestion; ids.push(q.id);
check("question 4 follows", r.status === 200 && q?.questionOrder === 4, r.text);
r = await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: q.id, answerText: vague, secondsTaken: 20 });
check("last answer finishes the interview", r.status === 200 && r.json.done === true && r.json.nextQuestion === null, r.text);
check("no question repeated", new Set(ids).size === 4, ids.join(","));
check("answering a finished interview -> 409", (await a.call("POST", `/api/interviews/${iv.id}/answer`, { questionId: q.id, answerText: "a b c" })).status === 409);

r = await a.call("GET", `/api/interviews/${iv.id}/report`);
const rep = r.json?.report;
check("report exists with scores in range", r.status === 200 && Number.isInteger(rep.overallScore) && rep.overallScore >= 0 && rep.overallScore <= 100 && ["Interview ready", "Getting there", "Needs more practice"].includes(rep.readiness), r.text);
check("vague answers score low, skip scores 0", rep.overallScore < 40 && rep.questions[1].skipped && rep.questions[1].score === 0, JSON.stringify(rep.questions.map((x) => x.score)));
check("report lists every question with model answer, concepts and notes", rep.questions.length === 4 && rep.questions.every((x) => x.modelAnswer.length > 20 && x.concepts.length >= 3 && Array.isArray(x.notes)), r.text.slice(0, 300));
check("completion counts are right", rep.completion.planned === 4 && rep.completion.answered === 3 && rep.completion.skipped === 1, JSON.stringify(rep.completion));
check("technical-only report has no behavioural score", rep.technicalScore !== null && rep.behavioralScore === null, JSON.stringify([rep.technicalScore, rep.behavioralScore]));
check("report has strengths, improvements, recommendations and a caveat", rep.strengths.length > 0 && rep.improvements.length > 0 && rep.recommendations.length > 0 && /cannot tell whether/.test(rep.caveat), r.text.slice(0, 200));
check("the weak topic points to something to study", rep.recommendations.some((x) => /Revise/.test(x.text)), JSON.stringify(rep.recommendations));
check("another user cannot read the report -> 404", (await b.call("GET", `/api/interviews/${iv.id}/report`)).status === 404);

// ------------------------------------------------------------ HR interview ended early
r = await a.call("POST", "/api/interviews", { interviewType: "HR", difficulty: "EASY", numberOfQuestions: 3, targetRole: "iOS Mobile Engineer" });
const hr = r.json;
check("HR interview stores the custom role and asks an HR question", r.status === 201 && hr.targetRole === "iOS Mobile Engineer" && hr.currentQuestion.kind === "HR", r.text);
const star = "During my final year project our team of four had to build a placement portal in six weeks. My role was the backend, so I designed the database and wrote the APIs myself. When we fell behind I organised daily standups. As a result we delivered on time and scored 92% in the review.";
r = await a.call("POST", `/api/interviews/${hr.id}/answer`, { questionId: hr.currentQuestion.id, answerText: star, secondsTaken: 70 });
check("HR answer accepted", r.status === 200 && r.json.done === false, r.text);
r = await a.call("POST", `/api/interviews/${hr.id}/complete`);
check("ending early completes it", r.status === 200 && r.json.status === "COMPLETED" && r.json.answeredCount === 1, r.text);
r = await a.call("GET", `/api/interviews/${hr.id}/report`);
check("early report: 1 of 3 answered, behavioural only", r.status === 200 && r.json.report.completion.answered === 1 && r.json.report.completion.planned === 3 && r.json.report.behavioralScore !== null && r.json.report.technicalScore === null, r.text.slice(0, 300));
check("ending twice is harmless", (await a.call("POST", `/api/interviews/${hr.id}/complete`)).status === 200);

// ------------------------------------------------------------ mixed, adaptive, longest allowed
r = await a.call("POST", "/api/interviews", { interviewType: "MIXED", difficulty: "HARD", numberOfQuestions: 10, roleId: "software-engineer" });
const mixed = r.json;
const kinds = [], seen = new Set();
let cur = mixed.currentQuestion;
let ok = r.status === 201;
for (let i = 0; i < 10 && cur; i++) {
  kinds.push(cur.kind);
  if (seen.has(cur.id)) ok = false;
  seen.add(cur.id);
  const res = await a.call("POST", `/api/interviews/${mixed.id}/answer`, { questionId: cur.id, answerText: i % 2 ? "Not sure about this one honestly, I would need to look it up first before saying anything" : star });
  ok = ok && res.status === 200;
  cur = res.json?.nextQuestion;
}
check("mixed 10-question interview runs to the end without repeats", ok && kinds.length === 10 && seen.size === 10, kinds.join(","));
check("mixed round has both kinds", kinds.includes("HR") && kinds.includes("TECHNICAL") && kinds.filter((k) => k === "HR").length === 4, kinds.join(","));
r = await a.call("GET", `/api/interviews/${mixed.id}/report`);
check("mixed report has both section scores", r.status === 200 && r.json.report.technicalScore !== null && r.json.report.behavioralScore !== null && r.json.report.questions.length === 10, r.text.slice(0, 200));
r = await a.call("POST", "/api/interviews", { interviewType: "HR", difficulty: "MEDIUM", numberOfQuestions: 10 });
check("10 HR questions are available", r.status === 201, r.text);

// ------------------------------------------------------------ history and analytics
r = await a.call("GET", "/api/interviews/history");
check("history is newest first and has scores", r.status === 200 && r.json.length >= 4 && r.json[0].id > r.json[r.json.length - 1].id && r.json.filter((x) => x.status === "COMPLETED").every((x) => Number.isInteger(x.overallScore)), r.text.slice(0, 300));
const done = r.json.filter((x) => x.status === "COMPLETED");
check("history shows an in-progress interview as such", r.json.some((x) => x.status === "IN_PROGRESS" && x.answeredCount === 0), r.text.slice(0, 200));
r = await b.call("GET", "/api/interviews/history");
check("another user's history is empty", r.status === 200 && r.json.length === 0, r.text);
r = await a.call("GET", "/api/users/analytics");
const avg = Math.round(done.reduce((s, x) => s + x.overallScore, 0) / done.length);
check("analytics counts completed interviews and their average", r.status === 200 && r.json.mockInterviewsCompleted === done.length && Math.abs(r.json.averageMockInterviewScore - avg) <= 1, JSON.stringify([r.json.mockInterviewsCompleted, r.json.averageMockInterviewScore, done.length, avg]));

// ------------------------------------------------------------ delete
check("another user cannot delete it -> 404", (await b.call("DELETE", `/api/interviews/${iv.id}`)).status === 404);
check("owner deletes it", (await a.call("DELETE", `/api/interviews/${iv.id}`)).status === 200);
check("deleted interview is gone", (await a.call("GET", `/api/interviews/${iv.id}`)).status === 404);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
