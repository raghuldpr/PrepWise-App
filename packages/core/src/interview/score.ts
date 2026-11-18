import type { Concept, InterviewQuestion } from "@prepwise/content";

// Rule-based answer scoring. It checks which expected ideas an answer mentions and how it is built.
// It cannot judge whether a sentence is TRUE, so a wrong answer that uses the right words can score
// well. Anti-stuffing: an answer may only get credit for roughly one idea per few words.

export type ConceptResult = { label: string; hit: boolean; weight: number; matched?: string };

export type AnswerResult = {
  score: number; // 0-100
  verdict: "strong" | "partial" | "weak" | "skipped";
  words: number;
  concepts: ConceptResult[];
  /** Plain-language reasons, shown in the report. */
  notes: string[];
  /** 0-100 quality of the answer's form (length, structure, ownership), independent of content. */
  communication: number;
};

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/[-–—_/]/g, " ").replace(/\s+/g, " ").trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp | string>();

/** True when `term` occurs in normalized text: starts at a word boundary, and may be a prefix of a longer word. */
export function termMatches(text: string, term: string): boolean {
  const t = normalize(term);
  if (!t) return false;
  let m = cache.get(t);
  if (!m) {
    m = /^[a-z0-9]/.test(t) ? new RegExp(`(?:^|[^a-z0-9])${escape(t).replace(/ /g, "\\s+")}`) : t;
    cache.set(t, m);
  }
  return typeof m === "string" ? text.includes(m) : m.test(text);
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const EXAMPLE = /\b(for example|for instance|e\.g|such as|suppose|imagine|consider a|let's say|say a)\b/;

function matchConcepts(text: string, concepts: Concept[]): ConceptResult[] {
  return concepts.map((c) => {
    const matched = c.terms.find((t) => termMatches(text, t));
    return { label: c.label, hit: !!matched, weight: c.weight, matched };
  });
}

/** Credit at most `limit` hit concepts (heaviest first) so a pile of keywords cannot earn full marks. */
function coverage(results: ConceptResult[], limit: number): { value: number; credited: number } {
  const total = results.reduce((s, r) => s + r.weight, 0) || 1;
  const hits = results.filter((r) => r.hit).sort((a, b) => b.weight - a.weight);
  const credited = hits.slice(0, Math.max(1, limit));
  return { value: credited.reduce((s, r) => s + r.weight, 0) / total, credited: credited.length };
}

function ownership(text: string): number {
  const i = (text.match(/\b(i|i'm|i've|i'd|my|me)\b/g) ?? []).length;
  const we = (text.match(/\b(we|we're|we've|our|us)\b/g) ?? []).length;
  if (i + we === 0) return 0.4;
  return clamp01(i / (i + we) + 0.15);
}

const specificity = (text: string) =>
  clamp01(((/\d/.test(text) ? 0.5 : 0) + (/%|percent|hours|days|weeks|users|students|members|marks|score/.test(text) ? 0.25 : 0) + (EXAMPLE.test(text) ? 0.25 : 0)));

const verdictOf = (score: number): AnswerResult["verdict"] => (score >= 75 ? "strong" : score >= 50 ? "partial" : "weak");

export function skippedResult(q: InterviewQuestion): AnswerResult {
  return { score: 0, verdict: "skipped", words: 0, communication: 0, notes: ["You skipped this question."], concepts: q.concepts.map((c) => ({ label: c.label, hit: false, weight: c.weight })) };
}

export function scoreAnswer(q: InterviewQuestion, answer: string): AnswerResult {
  const text = normalize(answer);
  const words = wordCount(answer);
  if (words < 3) return { ...skippedResult(q), notes: ["The answer was too short to score."] };
  return q.kind === "HR" ? scoreHr(q, text, words) : scoreTechnical(q, text, words);
}

function scoreTechnical(q: InterviewQuestion, text: string, words: number): AnswerResult {
  const concepts = matchConcepts(text, q.concepts);
  const limit = Math.floor(words / 5);
  const cov = coverage(concepts, limit);
  const notes: string[] = [];
  const hitCount = concepts.filter((c) => c.hit).length;
  const depth = clamp01(words / 30);
  const example = EXAMPLE.test(text) ? 1 : 0;
  const communication = Math.round(100 * (0.6 * depth + 0.25 * example + 0.15 * ((text.match(/[.!?]/g) ?? []).length >= 2 ? 1 : 0.4)));

  let score = 0;
  if (hitCount > 0) score = Math.round(100 * (0.82 * cov.value + 0.12 * depth + 0.06 * example));
  if (hitCount === 0) notes.push("None of the key ideas for this question were found in your answer.");
  else if (hitCount < q.concepts.length) notes.push(`You covered ${hitCount} of ${q.concepts.length} key ideas.`);
  else notes.push("You touched on every key idea.");
  if (cov.credited < hitCount) notes.push("Your answer mentions more ideas than its length can explain; say what each one means, not only its name.");
  if (words < 20) notes.push("Very short: explain each idea in a sentence.");
  if (!example && q.concepts.length > 2) notes.push("Adding a short example makes an answer much stronger.");
  return { score: Math.min(100, score), verdict: verdictOf(score), words, concepts, notes, communication };
}

function scoreHr(q: InterviewQuestion, text: string, words: number): AnswerResult {
  const concepts = matchConcepts(text, q.concepts);
  const limit = Math.floor(words / 8);
  const cov = coverage(concepts, limit);
  const hitCount = concepts.filter((c) => c.hit).length;
  const length = clamp01(words / 50);
  const own = ownership(text);
  const spec = specificity(text);
  const communication = Math.round(100 * (0.45 * length + 0.3 * own + 0.25 * spec));
  const notes: string[] = [];

  // Form only multiplies relevance: a polished story that answers some other question must not score well.
  const quality = 0.42 * length + 0.26 * own + 0.32 * spec;
  let score = Math.round(100 * cov.value * (0.55 + 0.45 * quality));
  if (hitCount === 0) score = Math.min(score, 20);
  const missing = concepts.filter((c) => !c.hit).map((c) => c.label.toLowerCase());
  if (missing.length && hitCount > 0) notes.push(`Missing: ${missing.slice(0, 3).join("; ")}.`);
  if (hitCount === 0) notes.push("The answer did not address what this question asks for.");
  if (words < 35) notes.push("Too brief for a behavioural answer. Aim for 60 to 120 words (about 30 to 60 seconds).");
  if (own < 0.5) notes.push('Say "I" for what you did yourself; "we" hides your contribution.');
  if (spec < 0.5) notes.push("Add something specific: a number, a result or a named example.");
  if (words > 220) notes.push("Quite long. Keep it tight: situation, what you did, result.");
  return { score: Math.min(100, score), verdict: verdictOf(score), words, concepts, notes, communication };
}
