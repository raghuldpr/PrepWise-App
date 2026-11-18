import { ROLE_BY_ID, ROLES, type RoleProfile } from "@prepwise/content";
import { analyzeJobDescription, stem } from "./jd";
import { headingOf, type SectionId, sectionText, splitSections } from "./sections";
import { extractSkills, type FoundSkill } from "./skills";
import {
  dateIssues, detectContact, findDateRanges, hasEducationDetail, isDescriptionLine, isQuantified,
  startsWithActionVerb, stripBullet, weakPhrase, wordCount,
} from "./signals";

export const ANALYZER_VERSION = "1.0.0";

export type BreakdownItem = { id: string; label: string; score: number; max: number; detail: string };
export type Advice = { priority: "high" | "medium" | "low"; text: string };
export type MissingSkill = { label: string; weight: 1 | 2 | 3 };

export type ResumeAnalysis = {
  version: string;
  score: number;
  grade: string;
  target: { kind: "role" | "jd"; label: string };
  breakdown: BreakdownItem[];
  skills: {
    found: FoundSkill[];
    missing: MissingSkill[];
    listedOnly: string[];
    jdKeywords?: { matched: string[]; missing: string[] };
  };
  sections: { id: SectionId; present: boolean }[];
  contact: { email: boolean; phone: boolean; github: boolean; linkedin: boolean };
  stats: { words: number; descriptionLines: number; quantifiedLines: number; actionVerbLines: number; weakPhraseLines: number; dateRanges: number };
  strengths: string[];
  weaknesses: string[];
  suggestions: Advice[];
};

export type AnalyzeInput = {
  text: string;
  roleId?: string;
  /** Free-text role used only for the label when roleId is not one of the known roles. */
  roleLabel?: string;
  jobDescription?: string;
  now?: Date;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export const gradeOf = (score: number) =>
  score >= 80 ? "Strong" : score >= 65 ? "Good" : score >= 45 ? "Needs work" : "Early draft";

const EVIDENCE_LISTED = 0.7; // a skill that is only listed counts less than one that is shown in a project

function evidenceFor(found: Map<string, FoundSkill>, name: string): number {
  const f = found.get(name);
  if (!f) return 0;
  return f.demonstrated ? 1 : EVIDENCE_LISTED;
}

// -------------------------------------------------------------------- role / JD matching
function matchRole(role: RoleProfile, found: Map<string, FoundSkill>) {
  let got = 0, total = 0;
  const missing: MissingSkill[] = [];
  for (const rs of role.skills) {
    total += rs.weight;
    if ("skill" in rs) {
      const ev = evidenceFor(found, rs.skill);
      got += rs.weight * ev;
      if (!ev) missing.push({ label: rs.skill, weight: rs.weight });
    } else {
      const ev = Math.max(0, ...rs.anyOf.map((n) => evidenceFor(found, n)));
      got += rs.weight * ev;
      if (!ev) missing.push({ label: rs.label, weight: rs.weight });
    }
  }
  return { ratio: total ? got / total : 0, missing: missing.sort((a, b) => b.weight - a.weight) };
}

export function analyzeResume(input: AnalyzeInput): ResumeAnalysis {
  const now = input.now ?? new Date();
  const text = input.text.replace(/\r/g, "").trim();
  const split = splitSections(text);
  const skillsLines = sectionText(split, "skills");
  const skillsLineSet = new Set(skillsLines);
  const otherLines = text.split("\n").map((l) => l.trim()).filter((l) => l && !skillsLineSet.has(l) && !headingOf(l));
  const foundList = extractSkills(skillsLines, otherLines);
  const found = new Map(foundList.map((f) => [f.name, f]));

  const has = (id: SectionId) => split.sections.some((s) => s.id === id && s.lines.length > 0);
  const contact = detectContact(split.header, text);
  const words = wordCount(text);

  const workLines = sectionText(split, "experience", "projects", "achievements");
  const descLines = workLines.filter(isDescriptionLine);
  const quantified = descLines.filter(isQuantified);
  const verbLines = descLines.filter(startsWithActionVerb);
  const weakLines = descLines.map((l) => ({ l, p: weakPhrase(l) })).filter((x) => x.p);
  const ranges = findDateRanges(text.split("\n"), now);
  const issues = dateIssues(ranges, now);
  const edu = hasEducationDetail(sectionText(split, "education"));

  // ------------------------------------------------ target: JD wins over role
  let target: ResumeAnalysis["target"];
  let matchRatio: number;
  let missing: MissingSkill[] = [];
  let jdKeywords: { matched: string[]; missing: string[] } | undefined;
  let roleForTitle: RoleProfile | undefined;

  const jdText = input.jobDescription?.trim();
  if (jdText && jdText.length >= 40) {
    const jd = analyzeJobDescription(jdText);
    target = { kind: "jd", label: input.roleLabel?.trim() || "the pasted job description" };
    const skillRatio = jd.skills.length
      ? jd.skills.reduce((s, k) => s + evidenceFor(found, k.name), 0) / jd.skills.length
      : null;
    missing = jd.skills.filter((k) => !found.has(k.name)).map((k) => ({ label: k.name, weight: 3 as const }));
    const resumeStems = new Set((text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []).map(stem));
    const matched = jd.keywords.filter((k) => resumeStems.has(stem(k)));
    jdKeywords = { matched, missing: jd.keywords.filter((k) => !matched.includes(k)) };
    const kwRatio = jd.keywords.length ? matched.length / jd.keywords.length : null;
    matchRatio = skillRatio !== null && kwRatio !== null ? 0.75 * skillRatio + 0.25 * kwRatio : (skillRatio ?? kwRatio ?? 0);
    roleForTitle = input.roleId ? ROLE_BY_ID.get(input.roleId) : undefined;
  } else {
    const role = (input.roleId && ROLE_BY_ID.get(input.roleId)) || ROLES[0];
    roleForTitle = role;
    target = { kind: "role", label: role.title };
    const m = matchRole(role, found);
    matchRatio = m.ratio;
    missing = m.missing;
  }

  // ------------------------------------------------ scoring (max 100)
  const breakdown: BreakdownItem[] = [];
  const add = (id: string, label: string, score: number, max: number, detail: string) =>
    breakdown.push({ id, label, score: round1(clamp(score, 0, max)), max, detail });

  add("match", target.kind === "jd" ? "Match with job description" : `Fit for ${target.label}`, 35 * matchRatio, 35,
    target.kind === "jd" ? "Skills and keywords from the posting found in your resume." : "How many of the role's key skills your resume shows (skills used in projects count fully, skills only listed count 70%).");

  const techCount = foundList.filter((f) => f.category !== "Soft Skills").length;
  add("breadth", "Skills breadth", 12 * Math.min(1, techCount / 12) + (has("skills") ? 3 : 0), 15,
    `${techCount} technical skills recognised${has("skills") ? "" : "; no Skills section found"}.`);

  const comp =
    (contact.email ? 3 : 0) + (contact.phone ? 2 : 0) + (contact.github || contact.linkedin ? 2 : 0) +
    (has("education") ? 3 : 0) + (has("skills") ? 2 : 0) + (has("projects") || has("experience") ? 3 : 0);
  add("completeness", "Completeness", comp, 15, "Contact details, links, education, skills, and projects or experience.");

  const qRatio = descLines.length ? quantified.length / descLines.length : 0;
  const vRatio = descLines.length ? verbLines.length / descLines.length : 0;
  const impact = descLines.length
    ? 8 * Math.min(1, qRatio / 0.4) + 6 * Math.min(1, vRatio / 0.7) + 6 * Math.min(1, descLines.length / 8) - Math.min(4, weakLines.length)
    : 0;
  add("impact", "Impact and writing", impact, 20,
    descLines.length ? `${quantified.length} of ${descLines.length} description lines contain numbers; ${verbLines.length} start with an action verb.` : "No project or experience descriptions found.");

  const lengthScore = words >= 250 && words <= 750 ? 5 : (words >= 150 && words < 250) || (words > 750 && words <= 1000) ? 3 : 1;
  const dateScore = ranges.length === 0 ? 2 : issues.length === 0 ? 3 : 0;
  add("hygiene", "Format and length", lengthScore + dateScore + (contact.name ? 2 : 0), 10,
    `${words} words${issues.length ? `; ${issues.length} date issue${issues.length > 1 ? "s" : ""}` : ""}.`);

  const titleText = [...split.header, ...sectionText(split, "summary", "projects", "experience")].join(" ").toLowerCase();
  const titleHit = roleForTitle?.titleKeywords.some((k) => titleText.includes(k)) ?? false;
  add("alignment", "Role alignment", titleHit ? 5 : matchRatio > 0.5 ? 2 : 0, 5,
    titleHit ? "Your resume mentions the target role." : "Mention the target role in a headline, summary or project title.");

  const score = Math.round(breakdown.reduce((s, b) => s + b.score, 0));

  // ------------------------------------------------ advice
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: Advice[] = [];
  const roleName = target.label;

  if (techCount >= 10) strengths.push(`${techCount} technical skills recognised, a broad toolkit.`);
  if (matchRatio >= 0.7) strengths.push(`Strong match for ${roleName}: ${Math.round(matchRatio * 100)}% of the key requirements are visible.`);
  if (descLines.length >= 4 && qRatio >= 0.3) strengths.push(`${Math.round(qRatio * 100)}% of your description lines include numbers, which recruiters look for.`);
  if (descLines.length >= 4 && vRatio >= 0.6) strengths.push("Most bullet points start with an action verb.");
  if (contact.email && contact.phone && (contact.github || contact.linkedin)) strengths.push("Contact details and professional links are present.");
  if (contact.github) strengths.push("A GitHub link lets reviewers see your code.");

  const missingSections: [SectionId, string, string][] = [
    ["skills", "Skills", "Add a Skills section listing languages, frameworks, databases and tools, grouped by type."],
    ["education", "Education", "Add an Education section with your degree, college, graduation year and CGPA or percentage."],
  ];
  for (const [id, name, tip] of missingSections) if (!has(id)) { weaknesses.push(`No ${name} section found.`); suggestions.push({ priority: "high", text: tip }); }
  if (!has("projects") && !has("experience")) {
    weaknesses.push("No Projects or Experience section found.");
    suggestions.push({ priority: "high", text: "Add 2-3 projects (or internships). For each, write what you built, the tools you used and the result." });
  }
  if (!contact.email) { weaknesses.push("No email address detected."); suggestions.push({ priority: "high", text: "Put a professional email address in the header." }); }
  if (!contact.phone) suggestions.push({ priority: "medium", text: "Add a phone number in the header." });
  if (!contact.github && !contact.linkedin) { weaknesses.push("No GitHub or LinkedIn link."); suggestions.push({ priority: "medium", text: "Link your GitHub and LinkedIn profiles so recruiters can verify your work." }); }
  else if (!contact.github) suggestions.push({ priority: "low", text: "Add your GitHub profile link to show your code." });

  if (descLines.length === 0 && (has("projects") || has("experience"))) {
    weaknesses.push("Projects and experience have little or no description.");
    suggestions.push({ priority: "high", text: "Describe each project in 2-3 bullet points: what you built, which technologies you used, and the outcome." });
  } else if (descLines.length > 0 && descLines.length < 5) {
    suggestions.push({ priority: "medium", text: "Add more detail: aim for at least 2-3 bullet points per project or internship." });
  }
  if (descLines.length >= 3 && qRatio < 0.3) {
    weaknesses.push(`Only ${quantified.length} of ${descLines.length} description lines contain numbers.`);
    suggestions.push({ priority: "high", text: "Add measurable results, e.g. 'Reduced page load time by 35%', 'Built 6 REST endpoints', 'Handled 500+ daily requests'. Estimate honestly if you do not have exact figures." });
  }
  if (weakLines.length) {
    weaknesses.push(`${weakLines.length} bullet point${weakLines.length > 1 ? "s use" : " uses"} weak wording such as "${weakLines[0].p}".`);
    suggestions.push({ priority: "medium", text: `Start bullets with strong verbs (Built, Implemented, Designed, Optimized) instead of phrases like "${weakLines[0].p}". Example: "${stripBullet(weakLines[0].l).slice(0, 70)}..."` });
  }
  if (descLines.length >= 4 && vRatio < 0.5) suggestions.push({ priority: "medium", text: "Begin more bullet points with action verbs: Developed, Designed, Deployed, Automated, Improved." });

  if (words < 150) { weaknesses.push("The resume is very short."); suggestions.push({ priority: "high", text: "Expand the resume to roughly one full page (300-600 words) with projects, skills and education." }); }
  else if (words < 250) suggestions.push({ priority: "low", text: "The resume is a little short; add one more project or more detail on existing ones." });
  else if (words > 900) { weaknesses.push("The resume is long."); suggestions.push({ priority: "medium", text: "Trim to one page (about 400-700 words) for a fresher resume: keep the strongest projects and remove filler." }); }

  for (const i of issues.slice(0, 3)) { weaknesses.push(i.text); suggestions.push({ priority: "medium", text: i.text }); }
  if (has("education") && !edu.score) suggestions.push({ priority: "low", text: "Add your CGPA or percentage to the Education section; many companies filter on it." });

  const listedOnly = foundList.filter((f) => !f.demonstrated && f.category !== "Soft Skills").map((f) => f.name);
  if (listedOnly.length >= 3) suggestions.push({ priority: "low", text: `These skills are listed but not shown in any project or experience: ${listedOnly.slice(0, 6).join(", ")}. Mention them in a project description to prove them.` });

  const core = missing.filter((m) => m.weight === 3);
  if (core.length) {
    weaknesses.push(`Key ${target.kind === "jd" ? "requirements" : "skills for " + roleName} not found: ${core.slice(0, 4).map((m) => m.label).join(", ")}.`);
    suggestions.push({ priority: "high", text: `If you have experience with ${core.slice(0, 3).map((m) => m.label).join(", ")}, add it to your Skills section and show it in a project. If not, build a small project that uses it.` });
  }
  if (jdKeywords && jdKeywords.missing.length) suggestions.push({ priority: "low", text: `Words that repeat in the job description but not in your resume: ${jdKeywords.missing.slice(0, 6).join(", ")}. Use them where they honestly describe your work.` });

  const order = { high: 0, medium: 1, low: 2 } as const;
  suggestions.sort((a, b) => order[a.priority] - order[b.priority]);

  const SECTION_IDS: SectionId[] = ["summary", "education", "experience", "projects", "skills", "certifications", "achievements"];
  return {
    version: ANALYZER_VERSION,
    score,
    grade: gradeOf(score),
    target,
    breakdown,
    skills: { found: foundList, missing, listedOnly, jdKeywords },
    sections: SECTION_IDS.map((id) => ({ id, present: has(id) })),
    contact: { email: contact.email, phone: contact.phone, github: contact.github, linkedin: contact.linkedin },
    stats: {
      words, descriptionLines: descLines.length, quantifiedLines: quantified.length, actionVerbLines: verbLines.length,
      weakPhraseLines: weakLines.length, dateRanges: ranges.length,
    },
    strengths,
    weaknesses,
    suggestions,
  };
}
