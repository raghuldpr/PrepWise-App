import { skillsInText } from "./skills";

const STOP = new Set(`a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just may me more most must my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your
experience work working team teams looking candidate candidates ability able strong good great excellent knowledge understanding responsibilities requirements required preferred plus years year role job position company opportunity join etc including include includes etc using use used well new need needs skills skill proven demonstrated relevant related based across within ensure ensuring help support support supports develop developing building build`.split(/\s+/));

/** Very small suffix stemmer: enough to match "optimizing"/"optimized"/"optimize" and plurals. */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  for (const [suf, min] of [["ations", 5], ["ation", 5], ["ments", 5], ["ment", 5], ["ings", 4], ["ing", 4], ["ies", 4], ["ied", 4], ["ed", 4], ["es", 4], ["s", 4], ["ly", 4]] as const) {
    if (w.endsWith(suf) && w.length - suf.length >= min - 1) {
      w = w.slice(0, -suf.length) + (suf === "ies" || suf === "ied" ? "y" : "");
      break;
    }
  }
  return w;
}

export type JdAnalysis = {
  skills: { name: string; category: string }[];
  keywords: string[]; // non-skill words that repeat in the posting (stems are matched, originals shown)
};

export function analyzeJobDescription(jd: string): JdAnalysis {
  const skills = skillsInText(jd).map((s) => ({ name: s.name, category: s.category }));
  const skillWords = new Set(skills.flatMap((s) => s.name.toLowerCase().split(/[^a-z0-9]+/)));
  const freq = new Map<string, { n: number; word: string }>();
  for (const w of jd.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []) {
    if (STOP.has(w) || skillWords.has(w)) continue;
    const k = stem(w);
    const prev = freq.get(k);
    freq.set(k, { n: (prev?.n ?? 0) + 1, word: prev?.word ?? w });
  }
  const keywords = [...freq.entries()]
    .filter(([, v]) => v.n >= 2)
    .sort((a, b) => b[1].n - a[1].n || a[1].word.localeCompare(b[1].word))
    .slice(0, 12)
    .map(([, v]) => v.word);
  return { skills, keywords };
}
