export type SectionId =
  | "summary" | "education" | "experience" | "projects" | "skills"
  | "certifications" | "achievements" | "other";

const HEADINGS: Record<Exclude<SectionId, "other">, string[]> = {
  summary: ["summary", "professional summary", "career summary", "objective", "career objective", "profile", "professional profile", "about me", "about"],
  education: ["education", "academic background", "academics", "academic qualifications", "qualifications", "education details", "educational qualifications"],
  experience: ["experience", "work experience", "professional experience", "internships", "internship experience", "internship", "employment", "employment history", "work history", "industrial training", "industrial experience", "training"],
  projects: ["projects", "academic projects", "personal projects", "project work", "key projects", "major projects", "technical projects", "project experience", "selected projects"],
  skills: ["skills", "technical skills", "key skills", "core competencies", "technologies", "skills & tools", "skills and tools", "tech stack", "areas of expertise", "technical proficiency", "technical expertise", "it skills", "programming skills"],
  certifications: ["certifications", "certificates", "licenses", "licenses & certifications", "courses", "online courses", "certifications & courses"],
  achievements: ["achievements", "awards", "honors", "honours", "accomplishments", "awards & achievements", "extracurricular", "extracurricular activities", "activities", "positions of responsibility", "leadership", "co-curricular activities", "volunteering", "responsibilities"],
};

const LOOKUP = new Map<string, SectionId>();
for (const [id, names] of Object.entries(HEADINGS)) for (const n of names) LOOKUP.set(n, id as SectionId);

const normalizeHeading = (line: string) =>
  line.toLowerCase().replace(/[^a-z& ]/g, " ").replace(/\s+/g, " ").trim();

/** Returns the section a line introduces, or null if the line is not a heading. */
export function headingOf(line: string): SectionId | null {
  const t = line.trim();
  if (!t || t.length > 45) return null;
  if (t.split(/\s+/).length > 6) return null;
  if (/[.!?]$/.test(t) && !/:$/.test(t)) return null;
  const n = normalizeHeading(t);
  return LOOKUP.get(n) ?? null;
}

export type Section = { id: SectionId; title: string; lines: string[] };
export type SplitResult = { header: string[]; sections: Section[] };

export function splitSections(text: string): SplitResult {
  const header: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const id = headingOf(line);
    if (id) {
      current = { id, title: line.replace(/:$/, ""), lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
    else header.push(line);
  }
  return { header, sections };
}

export const sectionText = (r: SplitResult, ...ids: SectionId[]) =>
  r.sections.filter((s) => ids.includes(s.id)).flatMap((s) => s.lines);
