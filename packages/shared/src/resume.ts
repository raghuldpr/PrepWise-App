import { SKILL_NAMES } from "@prepwise/content";
import { z } from "zod";

// Server-side validation of an analysis computed in the browser. The analysis only describes the
// user's own resume, so the goal is not anti-cheat but to keep stored data well-formed and bounded.

const str = (max: number) => z.string().max(max);

export const resumeAnalysisSchema = z
  .object({
    version: str(20),
    score: z.number().int().min(0).max(100),
    grade: str(40),
    target: z.object({ kind: z.enum(["role", "jd"]), label: str(200) }),
    breakdown: z
      .array(z.object({ id: str(30), label: str(120), score: z.number().min(0).max(100), max: z.number().min(0).max(100), detail: str(500) }))
      .min(1).max(10),
    skills: z.object({
      found: z
        .array(z.object({ name: str(60), category: str(60), count: z.number().int().min(1).max(500), demonstrated: z.boolean() }))
        .max(120),
      missing: z.array(z.object({ label: str(200), weight: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).max(100),
      listedOnly: z.array(str(60)).max(120),
      jdKeywords: z.object({ matched: z.array(str(60)).max(30), missing: z.array(str(60)).max(30) }).optional(),
    }),
    sections: z.array(z.object({ id: str(30), present: z.boolean() })).max(12),
    contact: z.object({ email: z.boolean(), phone: z.boolean(), github: z.boolean(), linkedin: z.boolean() }),
    stats: z.object({
      words: z.number().int().min(0).max(100_000),
      descriptionLines: z.number().int().min(0).max(5000),
      quantifiedLines: z.number().int().min(0).max(5000),
      actionVerbLines: z.number().int().min(0).max(5000),
      weakPhraseLines: z.number().int().min(0).max(5000),
      dateRanges: z.number().int().min(0).max(500),
    }),
    strengths: z.array(str(500)).max(30),
    weaknesses: z.array(str(500)).max(30),
    suggestions: z.array(z.object({ priority: z.enum(["high", "medium", "low"]), text: str(800) })).max(40),
  })
  .superRefine((a, ctx) => {
    const sum = a.breakdown.reduce((s, b) => s + b.score, 0);
    if (Math.abs(sum - a.score) > 1.5) ctx.addIssue({ code: "custom", message: "score does not match the breakdown" });
    if (a.breakdown.some((b) => b.score > b.max)) ctx.addIssue({ code: "custom", message: "a breakdown score exceeds its maximum" });
    if (a.breakdown.reduce((s, b) => s + b.max, 0) !== 100) ctx.addIssue({ code: "custom", message: "breakdown maximums must add up to 100" });
    const bad = a.skills.found.find((f) => !SKILL_NAMES.has(f.name));
    if (bad) ctx.addIssue({ code: "custom", message: `unknown skill: ${bad.name}` });
  });

export type StoredResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;

export const RESUME_LIMITS = { textChars: 60_000, jdChars: 20_000, resumesPerUser: 20, analysesPerUser: 60 } as const;

export const saveAnalysisSchema = z.object({
  resumeId: z.number().int().positive().optional(), // re-analyse an existing resume
  filename: str(255),
  fileType: z.enum(["pdf", "docx", "txt"]),
  fileSize: z.number().int().min(0).max(10 * 1024 * 1024),
  text: z.string().min(20, "The resume text is too short").max(RESUME_LIMITS.textChars),
  targetRoleId: str(60).nullish(),
  targetRole: str(200),
  jobDescription: z.string().max(RESUME_LIMITS.jdChars).nullish(),
  result: resumeAnalysisSchema,
});
