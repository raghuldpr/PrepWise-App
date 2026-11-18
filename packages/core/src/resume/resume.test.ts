import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { analyzeResume, extractSkills, headingOf, itemsToText, splitSections, type PdfTextItem } from "../index";
import { dateIssues, detectContact, findDateRanges, isQuantified, weakPhrase } from "./signals";
import { JD_PYTHON_DJANGO, STRONG_BACKEND, WEAK_RESUME } from "./__fixtures__/resumes";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("sections", () => {
  it("recognises common headings and rejects sentences", () => {
    expect(headingOf("EDUCATION")).toBe("education");
    expect(headingOf("Technical Skills:")).toBe("skills");
    expect(headingOf("Work Experience")).toBe("experience");
    expect(headingOf("Academic Projects")).toBe("projects");
    expect(headingOf("I have experience building projects.")).toBeNull();
    expect(headingOf("Projects completed during my internship at Acme Corp")).toBeNull();
  });
  it("splits a resume into header and sections", () => {
    const r = splitSections(STRONG_BACKEND);
    expect(r.header[0]).toBe("Asha Rao");
    expect(r.sections.map((s) => s.id)).toEqual(["summary", "education", "skills", "experience", "projects", "achievements"]);
  });
});

describe("skill extraction", () => {
  const skills = (lines: string[], other: string[] = []) => Object.fromEntries(extractSkills(lines, other).map((s) => [s.name, s]));

  it("does not confuse C++, C#, Java and JavaScript", () => {
    const s = skills(["C++, C#, JavaScript"]);
    expect(Object.keys(s).sort()).toEqual(["C#", "C++", "JavaScript"]);
    expect(skills(["Java"]).Java).toBeTruthy();
    expect(skills(["Java"]).JavaScript).toBeUndefined();
  });
  it("matches node.js without treating its .js as JavaScript, and .NET", () => {
    const s = skills(["Node.js, Express.js, .NET"]);
    expect(s["Node.js"]).toBeTruthy();
    expect(s["JavaScript"]).toBeUndefined();
    expect(s["ASP.NET"]).toBeTruthy();
  });
  it("only counts ambiguous words (Go, C, R) inside skill lists", () => {
    expect(skills([], ["I will go to the office and read the C level report"]).Go).toBeUndefined();
    expect(skills([], ["I will go to the office and read the C level report"]).C).toBeUndefined();
    expect(skills(["Python, Go, R, C"]).Go).toBeTruthy();
    expect(skills(["Python, Go, R, C"]).R).toBeTruthy();
    expect(skills(["Python, Go, R, C"]).C).toBeTruthy();
  });
  it("separates listed from demonstrated skills", () => {
    const s = skills(["Java, Docker, Redis"], ["Deployed the service with Docker on AWS"]);
    expect(s.Docker.demonstrated).toBe(true);
    expect(s.Redis.demonstrated).toBe(false);
  });
});

describe("signals", () => {
  it("detects phone numbers but not date ranges or CGPA lines", () => {
    expect(detectContact([], "Asha Rao | +91 98765 43210").phone).toBe(true);
    expect(detectContact([], "Call (555) 123-4567").phone).toBe(true);
    expect(detectContact([], "B.Tech 2021 - 2025   CGPA 8.4").phone).toBe(false);
    expect(detectContact([], "Reg no 12345").phone).toBe(false);
  });
  it("does not count Spring Boot as the Spring Framework skill", () => {
    expect(extractSkills(["Spring Boot"], []).map((x) => x.name)).toEqual(["Spring Boot"]);
  });
  it("detects metrics but not dates", () => {
    expect(isQuantified("Reduced latency by 35% across 6 services")).toBe(true);
    expect(isQuantified("Built a website in 2024")).toBe(false);
    expect(isQuantified("Software Intern, Jun 2024 - Aug 2024")).toBe(false);
  });
  it("finds weak phrases", () => {
    expect(weakPhrase("Worked on a website for college")).toBe("worked on");
    expect(weakPhrase("Built a website for college")).toBeNull();
  });
  it("parses date ranges and flags impossible ones", () => {
    const ranges = findDateRanges(["B.E. 2024 - 2020", "Intern Jun 2024 - Aug 2024", "Dev 2022 - Present"], NOW);
    expect(ranges).toHaveLength(3);
    expect(ranges[2].end).toBe(2026);
    expect(dateIssues(ranges, NOW).map((i) => i.text).join(" ")).toMatch(/end date is before the start date/);
  });
});

describe("analyzeResume", () => {
  const strong = analyzeResume({ text: STRONG_BACKEND, roleId: "backend-developer", now: NOW });
  const weak = analyzeResume({ text: WEAK_RESUME, roleId: "backend-developer", now: NOW });

  it("scores a strong resume far above a weak one", () => {
    expect(strong.score).toBeGreaterThanOrEqual(75);
    expect(weak.score).toBeLessThanOrEqual(35);
    expect(strong.score - weak.score).toBeGreaterThan(40);
  });
  it("scores are bounded and the breakdown adds up to the score", () => {
    for (const a of [strong, weak]) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
      expect(a.breakdown.reduce((s, b) => s + b.max, 0)).toBe(100);
      expect(Math.abs(a.breakdown.reduce((s, b) => s + b.score, 0) - a.score)).toBeLessThan(1);
      for (const b of a.breakdown) { expect(b.score).toBeGreaterThanOrEqual(0); expect(b.score).toBeLessThanOrEqual(b.max); }
    }
  });
  it("finds the right skills and no false ones in the weak resume", () => {
    const names = strong.skills.found.map((s) => s.name);
    for (const n of ["Java", "Spring Boot", "MySQL", "Docker", "Redis", "REST APIs", "Git", "AWS"]) expect(names).toContain(n);
    expect(weak.skills.found.filter((s) => s.category !== "Soft Skills")).toHaveLength(0); // "go anywhere" is not Go
  });
  it("lists missing core skills for the role", () => {
    const labels = weak.skills.missing.map((m) => m.label).join(" | ");
    expect(labels).toMatch(/backend framework/);
    expect(labels).toMatch(/REST APIs/);
    expect(strong.skills.missing.filter((m) => m.weight === 3)).toHaveLength(0);
  });
  it("gives specific, prioritised advice for the weak resume", () => {
    const text = weak.suggestions.map((s) => s.text).join("\n");
    expect(weak.suggestions[0].priority).toBe("high");
    expect(text).toMatch(/Education|date/i);
    expect(text).toMatch(/strong verbs/);
    expect(text).toMatch(/GitHub/);
    expect(weak.weaknesses.join(" ")).toMatch(/end date is before the start date/);
    expect(weak.stats.weakPhraseLines).toBe(3);
  });
  it("praises what the strong resume does well", () => {
    expect(strong.strengths.join(" ")).toMatch(/numbers/);
    expect(strong.strengths.join(" ")).toMatch(/GitHub/);
  });
  it("matches against a pasted job description", () => {
    const a = analyzeResume({ text: STRONG_BACKEND, jobDescription: JD_PYTHON_DJANGO, roleLabel: "Backend Engineer", now: NOW });
    expect(a.target.kind).toBe("jd");
    const missing = a.skills.missing.map((m) => m.label);
    expect(missing).toContain("Kubernetes");
    expect(missing).toContain("Django");
    expect(missing).not.toContain("Docker");
    expect(a.skills.jdKeywords!.matched.concat(a.skills.jdKeywords!.missing).length).toBeGreaterThan(0);
    expect(a.suggestions.map((s) => s.text).join(" ")).toMatch(/Kubernetes/);
  });
  it("ignores a too-short job description and uses the role instead", () => {
    expect(analyzeResume({ text: STRONG_BACKEND, jobDescription: "hiring", roleId: "backend-developer", now: NOW }).target.kind).toBe("role");
  });
  it("handles empty or tiny input without throwing", () => {
    expect(() => analyzeResume({ text: "" })).not.toThrow();
    const a = analyzeResume({ text: "hello" });
    expect(a.score).toBeLessThan(25);
    expect(a.suggestions.length).toBeGreaterThan(0);
  });
  it("is deterministic", () => {
    expect(analyzeResume({ text: STRONG_BACKEND, roleId: "backend-developer", now: NOW })).toEqual(strong);
  });
});

// ---- real PDFs generated in the Iteration 0 spike (single column, two column, caps headings)
async function pdfText(file: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, "../../../../spikes/samples", file)));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: PdfTextItem[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    pages.push((tc.items as { str: string; transform: number[]; width: number; height: number }[]).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height })));
  }
  return itemsToText(pages);
}

describe("PDF layout reconstruction", () => {
  it("reads a single-column resume in order", async () => {
    const t = await pdfText("single-column.pdf");
    expect(splitSections(t).sections.map((s) => s.id)).toEqual(["education", "skills", "experience", "projects"]);
    expect(t).toMatch(/asha\.rao@example\.com/);
  });
  it("reads a two-column resume column by column (the spike's failure case)", async () => {
    const t = await pdfText("two-column.pdf");
    const r = splitSections(t);
    expect(r.sections.map((s) => s.id).sort()).toEqual(["education", "experience", "skills"]);
    const skills = r.sections.find((s) => s.id === "skills")!.lines.join(" ");
    expect(skills).toMatch(/Python/);
    expect(skills).not.toMatch(/Data Analyst/); // experience text must not leak into the skills column
    const exp = r.sections.find((s) => s.id === "experience")!.lines.join(" ");
    expect(exp).toMatch(/Automated weekly dashboards/);
  });
  it("handles resumes with plain caps headings", async () => {
    const t = await pdfText("no-headings-caps.pdf");
    expect(splitSections(t).sections.map((s) => s.id)).toEqual(["projects", "skills"]);
  });
});
