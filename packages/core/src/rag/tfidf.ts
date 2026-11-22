// TF-IDF retrieval with cosine similarity: the classic "bag of words" way to find the passages most like a query.
// Terms are lower-cased, stop words dropped and light-stemmed (so "scheduling" matches "schedule"). Title words
// count extra. Pure and deterministic; it runs in the browser, so the Worker spends no CPU on search.
// It matches WORDS, not meaning: a question phrased with unusual vocabulary can miss.
import { stem } from "../resume/jd";

export type Doc = { id: string; title: string; text: string };
export type Hit = { id: string; score: number; terms: string[] };
type Vec = Map<string, number>;
export type Index = { n: number; idf: Map<string, number>; vecs: Map<string, Vec>; norms: Map<string, number> };

const STOP = new Set(`a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just may me more most must my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your tell explain difference differences between give example examples use used using like need needs want get also one two three learn learning study studying prepare preparation roadmap topic topics`.split(/\s+/));

/** Words kept as they are because they are meaningful even when short or odd (c, r, sql, os, ...). */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().replace(/c\+\+/g, "cpp").replace(/c#/g, "csharp").replace(/node\.js/g, "nodejs").split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    if (raw.length < 2 && !["c", "r"].includes(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

const TITLE_WEIGHT = 3;

export function buildIndex(docs: Doc[]): Index {
  const tfs = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  for (const d of docs) {
    const tf = new Map<string, number>();
    for (const t of tokenize(d.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tokenize(d.title)) tf.set(t, (tf.get(t) ?? 0) + TITLE_WEIGHT);
    tfs.set(d.id, tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = docs.length;
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log((n + 1) / (c + 1)) + 1);
  const vecs = new Map<string, Vec>(), norms = new Map<string, number>();
  for (const [id, tf] of tfs) {
    const v: Vec = new Map();
    let sum = 0;
    for (const [t, c] of tf) { const w = (1 + Math.log(c)) * (idf.get(t) ?? 0); v.set(t, w); sum += w * w; }
    vecs.set(id, v);
    norms.set(id, Math.sqrt(sum) || 1);
  }
  return { n, idf, vecs, norms };
}

export type SearchOptions = { k?: number; minScore?: number };

/** The k passages most similar to the query. Returns nothing when no query word occurs in the index. */
export function search(index: Index, query: string, opts: SearchOptions = {}): Hit[] {
  const k = opts.k ?? 5, minScore = opts.minScore ?? 0.08;
  const q = new Map<string, number>();
  for (const t of tokenize(query)) if (index.idf.has(t)) q.set(t, (q.get(t) ?? 0) + 1);
  if (q.size === 0) return [];
  const qv: Vec = new Map();
  let qn = 0;
  for (const [t, c] of q) { const w = (1 + Math.log(c)) * (index.idf.get(t) as number); qv.set(t, w); qn += w * w; }
  qn = Math.sqrt(qn) || 1;
  const hits: Hit[] = [];
  for (const [id, v] of index.vecs) {
    let dot = 0;
    const terms: string[] = [];
    for (const [t, w] of qv) { const dw = v.get(t); if (dw) { dot += w * dw; terms.push(t); } }
    if (!dot) continue;
    const score = dot / (qn * (index.norms.get(id) as number));
    if (score >= minScore) hits.push({ id, score: Math.round(score * 1000) / 1000, terms });
  }
  return hits.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, k);
}
