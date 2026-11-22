import { Hono } from "hono";
import { z } from "zod";
import { chooseArm, mulberry32, rollingAccuracy, practiceDifficulty } from "@prepwise/core";
import { type AppEnv, httpError, requireAuth } from "../lib/http";

// Smart Practice: a multi-armed bandit (Thompson sampling, see packages/core/src/bandit) picks which category to
// practise next from the student's most recent answers. It reads at most 200 recent rows and writes nothing:
// the answer itself is recorded by the normal /api/attempts route, which is the bandit's reward signal.

export const smartRoutes = new Hono<AppEnv>();
smartRoutes.use("*", requireAuth);

const WINDOW = 200; // answers that count as "recent"
const querySchema = z.object({ moduleType: z.enum(["APTITUDE", "DSA", "TECHNICAL", "HR"]).optional() });

type Cat = { id: number; name: string; moduleType: string };
type Recent = { id: number; c: number; cat: number };

async function load(c: Parameters<typeof requireAuth>[0], moduleType?: string) {
  const db = c.env.DB;
  const userId = c.get("userId");
  const [cats, recent] = await db.batch([
    db.prepare(
      `SELECT c.id, c.name, c.module_type AS moduleType FROM question_categories c
       WHERE EXISTS (SELECT 1 FROM questions q WHERE q.category_id = c.id AND q.question_type = 'MCQ') ${moduleType ? "AND c.module_type = ?" : ""} ORDER BY c.id`,
    ).bind(...(moduleType ? [moduleType] : [])),
    db.prepare(
      `SELECT a.id, a.is_correct AS c, q.category_id AS cat FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = ? AND a.graded = 1 ORDER BY a.id DESC LIMIT ${WINDOW}`,
    ).bind(userId),
  ]);
  const categories = cats.results as Cat[];
  const ids = new Set(categories.map((x) => x.id));
  const rows = (recent.results as Recent[]).filter((r) => ids.has(r.cat)).reverse(); // oldest first
  return { categories, rows };
}

smartRoutes.get("/next", async (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) throw httpError(400, "Invalid module type");
  const { categories, rows } = await load(c, parsed.data.moduleType);
  if (categories.length === 0) throw httpError(404, "There are no practice questions yet.");

  const stats = categories.map((cat) => {
    const mine = rows.filter((r) => r.cat === cat.id);
    return { arm: cat.id, name: cat.name, right: mine.filter((r) => r.c === 1).length, wrong: mine.filter((r) => r.c !== 1).length };
  });
  // The seed changes with every new answer, so choices vary, but a page refresh before answering repeats the choice.
  const lastId = rows.length ? rows[rows.length - 1].id : 0;
  const seed = (Math.imul(c.get("userId"), 2654435761) + lastId) >>> 0;
  const pick = chooseArm(stats, seed)!;
  const cat = categories.find((x) => x.id === pick.arm)!;
  const wanted = practiceDifficulty(rows.filter((r) => r.cat === cat.id).map((r) => r.c === 1));

  const db = c.env.DB;
  const userId = c.get("userId");
  let candidates = (await db.prepare(
    `SELECT q.id, q.difficulty FROM questions q
     WHERE q.category_id = ? AND q.question_type = 'MCQ' AND q.id NOT IN (SELECT question_id FROM attempts WHERE user_id = ?)`,
  ).bind(cat.id, userId).all<{ id: number; difficulty: string }>()).results;
  let repeat = false;
  if (candidates.length === 0) {
    // everything here has been tried: bring back the one practised longest ago
    repeat = true;
    candidates = (await db.prepare(
      `SELECT q.id, q.difficulty, MAX(a.attempted_at) AS last FROM questions q JOIN attempts a ON a.question_id = q.id AND a.user_id = ?
       WHERE q.category_id = ? AND q.question_type = 'MCQ' GROUP BY q.id ORDER BY last ASC LIMIT 10`,
    ).bind(userId, cat.id).all<{ id: number; difficulty: string }>()).results;
  }
  if (candidates.length === 0) throw httpError(404, "No question available in that category.");

  const order = ["EASY", "MEDIUM", "HARD"];
  const dist = (d: string) => Math.abs(order.indexOf(d) - order.indexOf(wanted));
  const best = Math.min(...candidates.map((q) => dist(q.difficulty)));
  const near = candidates.filter((q) => dist(q.difficulty) === best);
  const chosen = near[Math.floor(mulberry32(seed + 1)() * near.length)];

  const [q, opts] = await db.batch([
    db.prepare("SELECT id, title, question_text AS questionText, difficulty, topic FROM questions WHERE id = ?").bind(chosen.id),
    db.prepare("SELECT id, option_text AS optionText FROM question_options WHERE question_id = ? ORDER BY id").bind(chosen.id),
  ]);
  return c.json({
    question: { ...(q.results[0] as object), categoryId: cat.id, categoryName: cat.name, moduleType: cat.moduleType, options: opts.results },
    choice: {
      categoryId: cat.id, categoryName: cat.name, mode: pick.mode, reason: pick.reason,
      targetDifficulty: wanted, repeat, windowSize: rows.length,
      arms: pick.arms.map((a) => ({ categoryId: a.arm, name: a.name, attempted: a.attempted, wrongRate: Math.round(a.wrongRate * 100), sampled: Math.round(a.sampled * 100) / 100, chosen: a.chosen })),
    },
  });
});

smartRoutes.get("/curve", async (c) => {
  const { categories, rows } = await load(c);
  const correct = rows.map((r) => r.c === 1);
  const rolling = rollingAccuracy(correct, 10);
  const mean = (xs: boolean[]) => (xs.length ? Math.round((100 * xs.filter(Boolean).length) / xs.length) : null);
  return c.json({
    points: correct.map((ok, i) => ({ n: i + 1, correct: ok, rolling: rolling[i] })),
    total: rows.length,
    window: WINDOW,
    first10: correct.length >= 20 ? mean(correct.slice(0, 10)) : null,
    last10: correct.length >= 20 ? mean(correct.slice(-10)) : null,
    categories: categories.map((cat) => {
      const mine = rows.filter((r) => r.cat === cat.id);
      return { categoryId: cat.id, name: cat.name, attempted: mine.length, accuracy: mine.length ? Math.round((100 * mine.filter((r) => r.c === 1).length) / mine.length) : null };
    }),
  });
});
