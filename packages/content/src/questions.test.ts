import { describe, expect, it } from "vitest";
import companies from "./companies.json";
import data from "./questions.json";

const { categories, questions } = data as {
  categories: { id: number; moduleType: string }[];
  questions: {
    id: number; categoryId: number; companyId: number | null; title: string; questionText: string;
    difficulty: string; questionType: string; expectedAnswer: string; options: { text: string; correct: boolean }[];
  }[];
};

describe("question bank integrity", () => {
  it("has unique ids and unique question text", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    expect(new Set(questions.map((q) => q.questionText.toLowerCase())).size).toBe(questions.length);
  });

  it("uses only valid enum values with no stray whitespace", () => {
    for (const q of questions) {
      expect(["EASY", "MEDIUM", "HARD"]).toContain(q.difficulty);
      expect(["MCQ", "CODING", "DESCRIPTIVE", "TECHNICAL", "HR"]).toContain(q.questionType);
      expect(q.title).toBe(q.title.trim());
      expect(q.questionText).toBe(q.questionText.trim());
    }
    for (const c of categories) expect(["APTITUDE", "CODING", "DSA", "TECHNICAL", "HR"]).toContain(c.moduleType);
  });

  it("references existing categories and companies", () => {
    const cat = new Set(categories.map((c) => c.id));
    const comp = new Set((companies as { id: number }[]).map((c) => c.id));
    for (const q of questions) {
      expect(cat.has(q.categoryId)).toBe(true);
      if (q.companyId !== null) expect(comp.has(q.companyId)).toBe(true);
    }
  });

  it("every MCQ has 2+ distinct options and exactly one correct answer matching expectedAnswer", () => {
    for (const q of questions.filter((x) => x.questionType === "MCQ")) {
      expect(q.options.length, q.title).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options.map((o) => o.text.toLowerCase())).size, q.title).toBe(q.options.length);
      const correct = q.options.filter((o) => o.correct);
      expect(correct.length, q.title).toBe(1);
      expect(correct[0].text, q.title).toBe(q.expectedAnswer);
    }
  });
});
