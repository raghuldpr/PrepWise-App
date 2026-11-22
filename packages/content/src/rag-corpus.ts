import base from "./questions.json";
import extra from "./questions-extra-1.json";
import { CODING_PROBLEMS } from "./coding";
import { INTERVIEW_QUESTIONS } from "./interview-bank";
import { TOPICS } from "./topics";

// The study material the assistant and the search page retrieve from: learning topics, interview questions,
// multiple-choice questions and coding problem statements. Coding reference SOLUTIONS are deliberately left out.
// Not exported from the package index on purpose: the JSON would land in every page's bundle. Import this file
// directly (the web app loads it lazily; the API reads single passages by id).

export type PassageKind = "topic" | "interview" | "question" | "coding";
export type Passage = { id: string; kind: PassageKind; title: string; text: string; link: string };

type Mcq = { id: number; categoryId: number; title: string; questionText: string; expectedAnswer?: string; explanation?: string };
const MCQ = [...(base.questions as unknown as Mcq[]), ...(extra.questions as unknown as Mcq[])];
const CATEGORY = new Map((base.categories as { id: number; name: string; moduleType: string }[]).map((c) => [c.id, c]));
const MODULE_LINK: Record<string, string> = { APTITUDE: "/placement/aptitude", DSA: "/placement/dsa", TECHNICAL: "/placement/technical", HR: "/interview/setup/role", CODING: "/placement/coding" };

export const KIND_LABEL: Record<PassageKind, string> = { topic: "Learning topic", interview: "Interview question", question: "Practice question", coding: "Coding problem" };

const clip = (s: string, n = 1200) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

const topicPassage = (id: string): Passage | undefined => {
  const t = TOPICS.find((x) => x.id === id);
  return t && {
    id: `topic:${t.id}`, kind: "topic", title: t.title, link: "/hub/roadmap",
    text: clip(`${t.title}. ${t.level} level, about ${t.hours} hours. Covers ${t.covers.join(", ")}. Outline: ${t.outline.join("; ")}. Practice: ${t.practice.join("; ")}.`),
  };
};
const interviewPassage = (id: string): Passage | undefined => {
  const q = INTERVIEW_QUESTIONS.find((x) => x.id === id);
  return q && {
    id: `interview:${q.id}`, kind: "interview", title: q.text, link: "/interview/setup/role",
    text: clip(`${q.text} Key ideas: ${q.concepts.map((c) => c.label).join(", ")}. ${q.kind === "HR" ? "How to approach it" : "Model answer"}: ${q.modelAnswer}`),
  };
};
const questionPassage = (id: string): Passage | undefined => {
  const q = MCQ.find((x) => String(x.id) === id);
  if (!q) return undefined;
  const cat = CATEGORY.get(q.categoryId);
  return {
    id: `question:${q.id}`, kind: "question", title: q.title, link: MODULE_LINK[cat?.moduleType ?? "TECHNICAL"] ?? "/placement",
    text: clip(`${q.title}. ${q.questionText} Answer: ${q.expectedAnswer ?? ""}. ${q.explanation ?? ""}`),
  };
};
const codingPassage = (id: string): Passage | undefined => {
  const p = CODING_PROBLEMS.find((x) => x.id === id);
  return p && {
    id: `coding:${p.id}`, kind: "coding", title: p.title, link: `/placement/coding/${p.id}`,
    text: clip(`${p.title} (${p.topic}, ${p.difficulty.toLowerCase()}). ${p.statement} Constraints: ${p.constraints.join("; ")}. Hints: ${p.hints.join(" ")}`),
  };
};

/** Every passage in a stable order (about 390). */
export function buildCorpus(): Passage[] {
  return [
    ...TOPICS.map((t) => topicPassage(t.id)!),
    ...INTERVIEW_QUESTIONS.map((q) => interviewPassage(q.id)!),
    ...MCQ.map((q) => questionPassage(String(q.id))!),
    ...CODING_PROBLEMS.map((p) => codingPassage(p.id)!),
  ];
}

export const PASSAGE_ID = /^(topic|interview|question|coding):[A-Za-z0-9._-]{1,80}$/;

/** Looks up one passage by id without building the whole corpus (used by the API). */
export function passageById(id: string): Passage | undefined {
  if (!PASSAGE_ID.test(id)) return undefined;
  const i = id.indexOf(":");
  const kind = id.slice(0, i), key = id.slice(i + 1);
  return kind === "topic" ? topicPassage(key) : kind === "interview" ? interviewPassage(key) : kind === "question" ? questionPassage(key) : codingPassage(key);
}
