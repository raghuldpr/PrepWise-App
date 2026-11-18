// Rule-based signals read from resume text: contact details, dates, bullet quality, length.

export type Contact = { email: boolean; phone: boolean; github: boolean; linkedin: boolean; name: boolean };

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;
const YEAR_RANGE = /(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:19|20)\d{2}/;
const digits = (s: string) => s.replace(/\D/g, "").length;

export function detectContact(headerLines: string[], fullText: string): Contact {
  const head = headerLines.slice(0, 8).join("\n");
  const phoneHit = [...fullText.matchAll(PHONE)].some((m) => digits(m[0]) >= 10 && digits(m[0]) <= 13 && !YEAR_RANGE.test(m[0]));
  const nameLine = headerLines.find((l) => {
    const t = l.trim();
    return t.length >= 3 && t.length <= 40 && t.split(/\s+/).length <= 5 && !/[\d@:/]/.test(t) && /^[\p{L} .'-]+$/u.test(t);
  });
  return {
    email: EMAIL.test(fullText),
    phone: phoneHit,
    github: /github\.com\/[\w-]+/i.test(fullText),
    linkedin: /linkedin\.com\/(in|pub)\/[\w-]+/i.test(fullText),
    name: !!nameLine || /^[\p{Lu}][\p{L}'-]+ [\p{Lu}]/u.test(head),
  };
}

// ---------------------------------------------------------------- dates
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
const DATE_RANGE = new RegExp(
  `((?:(?:${MONTHS})[a-z]*\\.?\\s*,?\\s*)?(?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*((?:present|current|ongoing|now|till date)|(?:(?:${MONTHS})[a-z]*\\.?\\s*,?\\s*)?(?:19|20)\\d{2})`,
  "gi",
);

export type DateRange = { raw: string; start: number; end: number; withMonth: boolean; line: string };
const yearOf = (s: string) => Number(s.match(/(19|20)\d{2}/)![0]);

export function findDateRanges(lines: string[], now = new Date()): DateRange[] {
  const out: DateRange[] = [];
  for (const line of lines) {
    for (const m of line.matchAll(DATE_RANGE)) {
      const start = yearOf(m[1]);
      const open = /present|current|ongoing|now|till/i.test(m[2]);
      const end = open ? now.getFullYear() : yearOf(m[2]);
      out.push({ raw: m[0], start, end, withMonth: new RegExp(MONTHS, "i").test(m[0]), line });
    }
  }
  return out;
}

export type DateIssue = { text: string };
export function dateIssues(ranges: DateRange[], now = new Date()): DateIssue[] {
  const issues: DateIssue[] = [];
  for (const r of ranges) {
    if (r.end < r.start) issues.push({ text: `The end date is before the start date in "${r.raw}".` });
    else if (r.start < 1990 || r.start > now.getFullYear() + 6) issues.push({ text: `The date "${r.raw}" looks wrong.` });
  }
  const months = ranges.filter((r) => r.withMonth).length;
  if (ranges.length >= 3 && months > 0 && months < ranges.length) {
    issues.push({ text: "Date formats are mixed (some with months, some years only). Use one format throughout." });
  }
  return issues;
}

// ---------------------------------------------------------------- bullets
const BULLET = /^[\s•·▪◦●○■□➢➤►\-–—*]+\s*/;
export const stripBullet = (l: string) => l.replace(BULLET, "").trim();

const ACTION_VERBS = new Set(`built developed designed implemented created led optimized optimised reduced improved deployed automated integrated analyzed analysed managed launched engineered architected migrated refactored tested maintained collaborated delivered established streamlined increased decreased boosted accelerated enhanced configured debugged resolved trained mentored coordinated organized organised presented researched evaluated generated produced secured scaled published won awarded achieved initiated spearheaded constructed formulated drove executed introduced modernized simplified transformed validated monitored administered programmed wrote authored contributed customized devised standardized ported cut saved raised designed`.split(/\s+/));

const WEAK_PHRASES = ["worked on", "responsible for", "helped", "assisted", "involved in", "participated in", "was part of", "tasked with", "duties included", "handled", "exposure to", "familiar with"];

export function isDescriptionLine(line: string): boolean {
  const t = stripBullet(line);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 5) return false;
  if (/^[\w\s,&/().+#-]*\s(?:19|20)\d{2}\s*(?:-|–|—|to)\s*/i.test(t) && words.length < 9) return false; // "Software Intern  Jun 2024 - Aug 2024"
  return true;
}

const QUANT = /(\d+(?:\.\d+)?\s?(?:%|x\b|k\b|m\b|\+|users|requests|ms\b|seconds|hours|days|projects|students|lakh|crore|records|endpoints|apis|tests|features|members|customers|queries))|[$₹€]\s?\d|\b\d{2,}\b/i;

export function isQuantified(line: string): boolean {
  // ignore dates, so "2024" alone does not count as a metric
  const noDates = line.replace(DATE_RANGE, " ").replace(/\b(19|20)\d{2}\b/g, " ");
  return QUANT.test(noDates);
}

export function startsWithActionVerb(line: string): boolean {
  const first = stripBullet(line).split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return ACTION_VERBS.has(first);
}

export function weakPhrase(line: string): string | null {
  const l = stripBullet(line).toLowerCase();
  return WEAK_PHRASES.find((p) => l.startsWith(p) || l.includes(` ${p} `)) ?? null;
}

export const wordCount = (text: string) => (text.match(/\S+/g) ?? []).length;

export function hasEducationDetail(lines: string[]) {
  const t = lines.join(" ").toLowerCase();
  return {
    degree: /\b(b\.?\s?tech|b\.?\s?e\b|bachelor|m\.?\s?tech|m\.?\s?e\b|master|mca|bca|b\.?\s?sc|m\.?\s?sc|mba|diploma|b\.?\s?com|phd)\b/.test(t),
    score: /\b(cgpa|gpa|percentage|percent)\b|\b\d{1,2}(\.\d{1,2})?\s?(\/\s?10|%)/.test(t),
  };
}
