// Smoke test for Smart Practice (bandit-chosen questions and the learning curve).
// Usage: node scripts/smoke-smart.mjs http://localhost:8787
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
const stamp = Date.now();
const user = async (t) => { const c = new Client(); await c.call("POST", "/api/auth/register", { name: `Smart ${t}`, email: `smart_${t}_${stamp}@example.com`, password: "Sup3r-secret!" }); return c; };

const a = await user("a");
check("next needs a session -> 401", (await new Client().call("GET", "/api/smart/next")).status === 401);
check("curve needs a session -> 401", (await new Client().call("GET", "/api/smart/curve")).status === 401);
check("bad module -> 400", (await a.call("GET", "/api/smart/next?moduleType=NOPE")).status === 400);

// ---- first question for a new user
let r = await a.call("GET", "/api/smart/next");
check("a new user gets a question with options and an explanation of the choice", r.status === 200 && r.json.question.options.length >= 2 && r.json.choice.arms.length >= 4 && r.json.choice.reason.length > 10, r.text.slice(0, 300));
check("the choice reports the target difficulty and whether it is exploring", ["EASY", "MEDIUM", "HARD"].includes(r.json.choice.targetDifficulty) && ["explore", "exploit"].includes(r.json.choice.mode) && r.json.choice.windowSize === 0, r.text.slice(0, 300));
check("the question never reveals the correct option", !/isCorrect|expectedAnswer|explanation/.test(JSON.stringify(r.json.question)), r.text.slice(0, 300));
check("exactly one category is marked as chosen", r.json.choice.arms.filter((x) => x.chosen).length === 1 && r.json.choice.arms.find((x) => x.chosen).categoryId === r.json.question.categoryId, r.text.slice(0, 300));
const again = await a.call("GET", "/api/smart/next");
check("a refresh before answering gives the same question", again.json.question.id === r.json.question.id, `${r.json.question.id} vs ${again.json.question.id}`);
r = await a.call("GET", "/api/smart/next?moduleType=APTITUDE");
check("the module filter limits the categories", r.status === 200 && r.json.question.moduleType === "APTITUDE" && r.json.choice.arms.every((x) => x.name), r.text.slice(0, 200));
r = await a.call("GET", "/api/smart/curve");
check("an empty curve for a new user", r.status === 200 && r.json.points.length === 0 && r.json.first10 === null && r.json.categories.length >= 4, r.text.slice(0, 300));

// ---- helpers: answer a question right or wrong at will (first answer once to learn the correct option)
const learned = new Map(); // questionId -> { correct option text, all option ids }
async function submit(client, q, wantRight) {
  let known = learned.get(q.id);
  if (!known) {
    const first = await client.call("POST", "/api/attempts", { questionId: q.id, selectedAnswer: String(q.options[0].id), timeTakenSeconds: 5 });
    known = { correctText: first.json.correctAnswer, options: q.options };
    learned.set(q.id, known);
    if (wantRight === first.json.isCorrect) return first.json.isCorrect;
  }
  const right = known.options.find((o) => o.optionText === known.correctText);
  const wrong = known.options.find((o) => o.optionText !== known.correctText);
  const res = await client.call("POST", "/api/attempts", { questionId: q.id, selectedAnswer: String((wantRight ? right : wrong).id), timeTakenSeconds: 5 });
  return res.json.isCorrect;
}

// ---- never repeats an unseen question
const b = await user("b");
const seen = new Set();
let dup = false;
for (let i = 0; i < 12; i++) {
  const n = await b.call("GET", "/api/smart/next");
  if (seen.has(n.json.question.id)) dup = true;
  seen.add(n.json.question.id);
  await submit(b, n.json.question, i % 2 === 0);
}
check("unseen questions come first (12 in a row, no repeats)", !dup && seen.size === 12);
r = await b.call("GET", "/api/smart/curve");
check("the curve has a point per graded answer, in order, with a rolling accuracy", r.json.points.length >= 12 && r.json.points.every((p, i) => p.n === i + 1 && p.rolling >= 0 && p.rolling <= 100), r.text.slice(0, 200));

// ---- the bandit favours the category the user keeps getting wrong
const c = await user("c");
const first = (await c.call("GET", "/api/smart/next")).json;
const cats = first.choice.arms.map((x) => x.categoryId);
const weak = cats[0];
// For each category practise one question, then repeat it with controlled results: always wrong in `weak`, always right elsewhere.
for (const cat of cats) {
  let q = null;
  for (let tries = 0; tries < 40 && !q; tries++) {
    const n = (await c.call("GET", "/api/smart/next")).json;
    if (n.question.categoryId === cat) q = n.question;
    else await submit(c, n.question, true); // moves the seed along and counts as a right answer elsewhere
  }
  if (!q) continue;
  for (let i = 0; i < 8; i++) await submit(c, q, cat !== weak);
}
let weakPicks = 0, draws = 30;
for (let i = 0; i < draws; i++) {
  const n = (await c.call("GET", "/api/smart/next")).json;
  if (n.question.categoryId === weak) weakPicks++;
  await submit(c, n.question, n.question.categoryId !== weak); // keep the pattern, and move the seed
}
const share = weakPicks / draws;
check(`the weak category is practised most (${Math.round(share * 100)}% of ${draws} draws, chance would be ${Math.round(100 / cats.length)}%)`, share >= 0.45 && share > 2 / cats.length, `share=${share}`);
r = await c.call("GET", "/api/smart/next");
const weakView = r.json.choice.arms.find((x) => x.categoryId === weak);
check("its estimated wrong rate is the highest", weakView.wrongRate === Math.max(...r.json.choice.arms.map((x) => x.wrongRate)), JSON.stringify(r.json.choice.arms));

// ---- isolation and analytics keep working
r = await a.call("GET", "/api/smart/curve");
check("another user's answers do not appear in this curve", r.json.total === 0, r.text.slice(0, 100));
r = await c.call("GET", "/api/users/analytics");
check("normal progress tracking still counts the answers", r.status === 200 && r.json.totalQuestionsAttempted > 50, String(r.json?.totalQuestionsAttempted));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
