import { Hono } from "hono";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { buildReport, pickQuestion, planKinds, scoreAnswer, skippedResult, type AnswerRecord, type InterviewReport } from "@prepwise/core";
import { INTERVIEW_BY_ID, INTERVIEW_QUESTIONS, ROLES, roleSkillNames, type InterviewDifficulty, type InterviewKind, type InterviewQuestion } from "@prepwise/content";
import { DIFFICULTIES, INTERVIEW_TYPES, interviews } from "../db/schema";
import { loadEvidence, resolveRole } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

export const interviewRoutes = new Hono<AppEnv>();
interviewRoutes.use("*", requireAuth);

const MAX_KEPT = 50;
const MAX_ANSWER_CHARS = 4000;
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 10;

const createSchema = z.object({
  interviewType: z.enum(INTERVIEW_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  numberOfQuestions: z.number().int().min(MIN_QUESTIONS).max(MAX_QUESTIONS),
  roleId: z.string().max(60).nullish(),
  targetRole: z.string().max(200).nullish(),
  companyName: z.string().max(120).nullish(),
});

const answerSchema = z.object({
  questionId: z.string().min(1).max(80),
  answerText: z.string().max(MAX_ANSWER_CHARS, `Keep the answer under ${MAX_ANSWER_CHARS} characters`).default(""),
  skipped: z.boolean().default(false),
  secondsTaken: z.number().int().min(0).max(7200).default(0),
});

type Plan = { kinds: InterviewKind[]; skills: string[] };
type Row = typeof interviews.$inferSelect;

const parse = <T>(json: string | null, fallback: T): T => {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** The question shown to the candidate: no concepts and no model answer, those are for the report. */
const publicQuestion = (q: InterviewQuestion, order: number, total: number) => ({
  id: q.id, kind: q.kind, questionType: q.kind, topic: q.topic, difficulty: q.difficulty, questionText: q.text,
  questionOrder: order, totalQuestions: total, ideaCount: q.concepts.length,
});

/** The question that comes next is a pure function of what is stored, so a refresh never changes it. */
function currentQuestion(row: Row) {
  const plan = parse<Plan>(row.planJson, { kinds: [], skills: [] });
  const answers = parse<AnswerRecord[]>(row.answersJson, []);
  if (row.status !== "IN_PROGRESS" || answers.length >= row.questionCount) return null;
  const kind = plan.kinds[answers.length];
  if (!kind) return null;
  const q = pickQuestion({
    kind, asked: answers.map((a) => a.questionId), lastScores: answers.map((a) => a.result.score),
    base: row.difficulty as InterviewDifficulty, skills: new Set(plan.skills), seed: String(row.id),
  });
  return q ? publicQuestion(q, answers.length + 1, row.questionCount) : null;
}

const summary = (r: Row) => {
  const answers = parse<AnswerRecord[]>(r.answersJson, []);
  return {
    id: r.id, interviewType: r.interviewType, targetRole: r.targetRole, companyName: r.companyName, difficulty: r.difficulty,
    questionCount: r.questionCount, answeredCount: answers.length, status: r.status, overallScore: r.overallScore,
    createdAt: r.createdAt, completedAt: r.completedAt,
  };
};

const own = async (c: Parameters<typeof getDb>[0], id: number) => {
  const [row] = await getDb(c).select().from(interviews).where(and(eq(interviews.id, id), eq(interviews.userId, c.get("userId"))));
  if (!row) throw httpError(404, `Interview not found with id: ${id}`);
  return row;
};
const idParam = (c: { req: { param: (k: string) => string } }) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) throw httpError(400, "Invalid id");
  return id;
};

async function finish(c: Parameters<typeof getDb>[0], row: Row, answers: AnswerRecord[]): Promise<InterviewReport> {
  const report = buildReport(answers, row.questionCount);
  await getDb(c).update(interviews)
    .set({ status: "COMPLETED", reportJson: JSON.stringify(report), overallScore: report.overallScore, completedAt: new Date().toISOString(), answersJson: JSON.stringify(answers) })
    .where(eq(interviews.id, row.id));
  return report;
}

interviewRoutes.get("/options", (c) => {
  const tech = INTERVIEW_QUESTIONS.filter((q) => q.kind === "TECHNICAL");
  const topics = [...new Set(tech.map((q) => q.topic))].sort();
  return c.json({
    types: [
      { id: "TECHNICAL", title: "Technical interview", description: "Concepts from OOP, DSA, DBMS, OS, networks, web and tools.", available: tech.length },
      { id: "HR", title: "HR and behavioural", description: "Self-introduction, teamwork, conflict, failure and motivation. Checked for structure and detail.", available: INTERVIEW_QUESTIONS.length - tech.length },
      { id: "MIXED", title: "Mixed round", description: "Technical questions with HR questions in between, like a real round.", available: INTERVIEW_QUESTIONS.length },
    ],
    difficulties: DIFFICULTIES,
    minQuestions: MIN_QUESTIONS,
    maxQuestions: MAX_QUESTIONS,
    topics,
    roles: ROLES.map((r) => ({ id: r.id, title: r.title })),
  });
});

interviewRoutes.post("/", validate("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const userId = c.get("userId");

  const { evidence, profileRole } = await loadEvidence(db, userId);
  const role = resolveRole(body.roleId, body.targetRole, profileRole);
  if (!role) throw httpError(400, "Unknown role");

  const kinds = planKinds(body.interviewType, body.numberOfQuestions);
  const hrNeeded = kinds.filter((k) => k === "HR").length;
  const hrAvailable = INTERVIEW_QUESTIONS.filter((q) => q.kind === "HR").length;
  if (hrNeeded > hrAvailable) throw httpError(400, `Only ${hrAvailable} HR questions are available; choose fewer questions`);

  const skills = [...new Set([...roleSkillNames(role), ...evidence.keys()])];
  const [row] = await db.insert(interviews).values({
    userId, interviewType: body.interviewType, targetRole: body.targetRole?.trim() || role.title, roleId: role.id,
    companyName: body.companyName?.trim() || null, difficulty: body.difficulty, questionCount: body.numberOfQuestions,
    planJson: JSON.stringify({ kinds, skills } satisfies Plan),
  }).returning();

  const keep = await db.select({ id: interviews.id }).from(interviews)
    .where(eq(interviews.userId, userId)).orderBy(desc(interviews.createdAt), desc(interviews.id)).limit(MAX_KEPT);
  await db.delete(interviews).where(and(eq(interviews.userId, userId), notInArray(interviews.id, keep.map((k) => k.id))));

  return c.json({ ...summary(row), currentQuestion: currentQuestion(row) }, 201);
});

interviewRoutes.get("/history", async (c) => {
  const rows = await getDb(c).select().from(interviews)
    .where(eq(interviews.userId, c.get("userId"))).orderBy(desc(interviews.createdAt), desc(interviews.id));
  return c.json(rows.map(summary));
});

interviewRoutes.get("/:id", async (c) => {
  const row = await own(c, idParam(c));
  return c.json({ ...summary(row), currentQuestion: currentQuestion(row) });
});

interviewRoutes.post("/:id/answer", validate("json", answerSchema), async (c) => {
  const row = await own(c, idParam(c));
  const body = c.req.valid("json");
  if (row.status !== "IN_PROGRESS") throw httpError(409, "This interview is already finished");

  const current = currentQuestion(row);
  if (!current) throw httpError(409, "There is no question left to answer");
  if (current.id !== body.questionId) throw httpError(409, "That is not the current question; reload the interview");
  const q = INTERVIEW_BY_ID.get(current.id)!;
  if (!body.skipped && body.answerText.trim().length === 0) throw httpError(400, "Write an answer, or skip the question");

  const answers = parse<AnswerRecord[]>(row.answersJson, []);
  const record: AnswerRecord = {
    questionId: q.id, answer: body.skipped ? "" : body.answerText.trim(), skipped: body.skipped, seconds: body.secondsTaken,
    result: body.skipped ? skippedResult(q) : scoreAnswer(q, body.answerText),
  };
  answers.push(record);

  if (answers.length >= row.questionCount) {
    await finish(c, row, answers);
    return c.json({ done: true, answeredCount: answers.length, nextQuestion: null });
  }
  const next = { ...row, answersJson: JSON.stringify(answers) };
  await getDb(c).update(interviews).set({ answersJson: next.answersJson }).where(eq(interviews.id, row.id));
  return c.json({ done: false, answeredCount: answers.length, nextQuestion: currentQuestion(next) });
});

interviewRoutes.post("/:id/complete", async (c) => {
  const row = await own(c, idParam(c));
  if (row.status === "COMPLETED") return c.json(summary(row));
  const answers = parse<AnswerRecord[]>(row.answersJson, []);
  if (answers.length === 0) throw httpError(400, "Answer at least one question first, or delete this interview");
  await finish(c, row, answers);
  return c.json(summary(await own(c, row.id)));
});

interviewRoutes.get("/:id/report", async (c) => {
  const row = await own(c, idParam(c));
  if (row.status !== "COMPLETED" || !row.reportJson) throw httpError(404, "This interview has no report yet");
  return c.json({
    interview: summary(row),
    report: parse<InterviewReport | null>(row.reportJson, null),
  });
});

interviewRoutes.delete("/:id", async (c) => {
  const row = await own(c, idParam(c));
  await getDb(c).delete(interviews).where(eq(interviews.id, row.id));
  return c.json({ message: "Interview deleted" });
});
