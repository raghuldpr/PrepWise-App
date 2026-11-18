import { INTERVIEW_BY_ID, TOPIC_FOR_SKILL, type InterviewDifficulty, type InterviewKind } from "@prepwise/content";
import type { AnswerResult } from "./score";

export type AnswerRecord = {
  questionId: string;
  answer: string;
  skipped: boolean;
  seconds: number;
  result: AnswerResult;
};

export type ReportQuestion = {
  order: number;
  id: string;
  kind: InterviewKind;
  topic: string;
  difficulty: InterviewDifficulty;
  text: string;
  answer: string;
  skipped: boolean;
  seconds: number;
  score: number;
  verdict: AnswerResult["verdict"];
  words: number;
  concepts: AnswerResult["concepts"];
  notes: string[];
  modelAnswer: string;
  tip: string;
};

export type InterviewReport = {
  version: string;
  overallScore: number;
  readiness: "Interview ready" | "Getting there" | "Needs more practice";
  technicalScore: number | null;
  behavioralScore: number | null;
  communicationScore: number;
  completion: { planned: number; answered: number; skipped: number };
  topics: { topic: string; kind: InterviewKind; average: number; count: number }[];
  strengths: string[];
  improvements: string[];
  recommendations: { text: string; link: string; label: string }[];
  questions: ReportQuestion[];
  caveat: string;
};

export const REPORT_VERSION = "1.0.0";
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
const list = (xs: string[], max = 3) => xs.slice(0, max).join(", ");

export function buildReport(records: AnswerRecord[], planned: number): InterviewReport {
  const questions: ReportQuestion[] = [];
  records.forEach((r, i) => {
    const q = INTERVIEW_BY_ID.get(r.questionId);
    if (!q) return; // a question removed from the bank later; leave it out rather than guess
    questions.push({
      order: i + 1, id: q.id, kind: q.kind, topic: q.topic, difficulty: q.difficulty, text: q.text,
      answer: r.skipped ? "" : r.answer, skipped: r.skipped, seconds: r.seconds,
      score: r.result.score, verdict: r.result.verdict, words: r.result.words, concepts: r.result.concepts, notes: r.result.notes,
      modelAnswer: q.modelAnswer, tip: q.tip,
    });
  });

  const tech = questions.filter((q) => q.kind === "TECHNICAL");
  const hr = questions.filter((q) => q.kind === "HR");
  const answered = questions.filter((q) => !q.skipped);
  const overallScore = avg(questions.map((q) => q.score));
  const communicationScore = avg(records.filter((r) => !r.skipped).map((r) => r.result.communication));

  const byTopic = new Map<string, { kind: InterviewKind; scores: number[] }>();
  for (const q of questions) {
    const e = byTopic.get(q.topic) ?? { kind: q.kind, scores: [] };
    e.scores.push(q.score);
    byTopic.set(q.topic, e);
  }
  const topics = [...byTopic].map(([topic, e]) => ({ topic, kind: e.kind, average: avg(e.scores), count: e.scores.length })).sort((a, b) => b.average - a.average);

  const strengths: string[] = [];
  for (const t of topics.filter((x) => x.average >= 70).slice(0, 2)) strengths.push(`Solid on ${t.topic} (${t.average}% on ${t.count} question${t.count === 1 ? "" : "s"}).`);
  for (const q of questions.filter((x) => x.verdict === "strong").slice(0, 2)) {
    const got = q.concepts.filter((c) => c.hit).map((c) => c.label.split(":")[0]);
    if (got.length) strengths.push(`Strong answer on "${q.topic}": you covered ${list(got)}.`);
  }
  if (overallScore >= 50 && answered.length && questions.every((q) => q.skipped || q.words >= 25)) strengths.push("You gave full answers rather than one-liners.");
  if (!strengths.length) strengths.push("No standout area yet: that is normal early on. The questions below show exactly what to add.");

  const improvements: string[] = [];
  for (const q of [...questions].sort((a, b) => a.score - b.score).filter((x) => x.score < 60).slice(0, 4)) {
    if (q.skipped) { improvements.push(`You skipped a ${q.topic} question: "${q.text}"`); continue; }
    const missed = q.concepts.filter((c) => !c.hit).map((c) => c.label);
    improvements.push(`${q.topic}: your answer to "${q.text}" missed ${list(missed)}.`);
  }
  const techWords = tech.filter((q) => !q.skipped).map((q) => q.words);
  if (techWords.length && avg(techWords) < 25) improvements.push(`Your technical answers averaged ${avg(techWords)} words. Aim for 40 to 80: define it, explain how it works, give an example.`);
  const weakHr = hr.filter((q) => !q.skipped && q.notes.some((n) => n.startsWith('Say "I"')));
  if (weakHr.length) improvements.push('In behavioural answers you said "we" more than "I". Interviewers want to hear what you personally did.');
  if (!improvements.length) improvements.push("Nothing major to fix. Try a harder difficulty next time.");

  const recommendations: InterviewReport["recommendations"] = [];
  const seen = new Set<string>();
  for (const q of [...tech].sort((a, b) => a.score - b.score).filter((x) => x.score < 65)) {
    const bank = INTERVIEW_BY_ID.get(q.id);
    const topic = bank?.skills.map((s) => TOPIC_FOR_SKILL.get(s)).find(Boolean);
    const key = topic?.id ?? q.topic;
    if (seen.has(key)) continue;
    seen.add(key);
    recommendations.push({
      text: topic ? `Revise ${topic.title} (about ${topic.hours} hours), then retry ${q.topic} questions.` : `Revise ${q.topic} and practise explaining it aloud.`,
      link: "/hub/roadmap", label: "Open my roadmap",
    });
    if (recommendations.length >= 2) break;
  }
  if (tech.some((q) => q.score < 65)) recommendations.push({ text: "Practise related multiple-choice questions to firm up the facts.", link: "/placement/technical", label: "Technical practice" });
  if (hr.some((q) => q.score < 65)) recommendations.push({ text: "Write out two stories (a team project and a failure) as: situation, task, your actions, result. Reuse them for most behavioural questions.", link: "/interview/setup/role", label: "Practise HR again" });
  if (!recommendations.length) recommendations.push({ text: "Raise the difficulty and try a mixed round.", link: "/interview/setup/role", label: "New interview" });

  const readiness = overallScore >= 75 ? "Interview ready" : overallScore >= 50 ? "Getting there" : "Needs more practice";
  return {
    version: REPORT_VERSION,
    overallScore,
    readiness,
    technicalScore: tech.length ? avg(tech.map((q) => q.score)) : null,
    behavioralScore: hr.length ? avg(hr.map((q) => q.score)) : null,
    communicationScore,
    completion: { planned, answered: answered.length, skipped: questions.length - answered.length },
    topics,
    strengths,
    improvements,
    recommendations,
    questions,
    caveat: "Scores come from rules that check which key ideas your answer mentions and how it is structured. They cannot tell whether a statement is correct, so read the model answer for every question and treat the score as a guide, not a verdict.",
  };
}
