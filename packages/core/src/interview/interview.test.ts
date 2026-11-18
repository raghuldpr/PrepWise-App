import { describe, expect, it } from "vitest";
import { INTERVIEW_QUESTIONS, SKILL_NAMES, type InterviewQuestion } from "@prepwise/content";
import { buildReport, pickQuestion, planKinds, scoreAnswer, skippedResult, targetDifficulty, type AnswerRecord } from "./index";

const tech = INTERVIEW_QUESTIONS.filter((q) => q.kind === "TECHNICAL");
const hr = INTERVIEW_QUESTIONS.filter((q) => q.kind === "HR");

describe("interview bank", () => {
  it("has unique ids, concepts, model answers and valid skills", () => {
    expect(new Set(INTERVIEW_QUESTIONS.map((q) => q.id)).size).toBe(INTERVIEW_QUESTIONS.length);
    for (const q of INTERVIEW_QUESTIONS) {
      expect(q.concepts.length, q.id).toBeGreaterThanOrEqual(3);
      for (const c of q.concepts) expect(c.terms.length, `${q.id}: ${c.label}`).toBeGreaterThan(0);
      expect(q.modelAnswer.length, q.id).toBeGreaterThan(40);
      for (const s of q.skills) expect(SKILL_NAMES.has(s), `${q.id}: ${s}`).toBe(true);
      if (q.kind === "TECHNICAL") expect(q.skills.length, q.id).toBeGreaterThan(0);
    }
  });
  it("is big enough for every difficulty", () => {
    for (const kind of ["TECHNICAL", "HR"] as const)
      for (const d of ["EASY", "MEDIUM"] as const) expect(INTERVIEW_QUESTIONS.filter((q) => q.kind === kind && q.difficulty === d).length, `${kind} ${d}`).toBeGreaterThanOrEqual(4);
    expect(tech.filter((q) => q.difficulty === "HARD").length).toBeGreaterThanOrEqual(4);
  });
  it("scores every technical model answer as strong (catches mistyped terms)", () => {
    const bad = tech.map((q) => ({ id: q.id, ...scoreAnswer(q, q.modelAnswer) })).filter((r) => r.score < 75).map((r) => `${r.id}=${r.score}`);
    expect(bad).toEqual([]);
  });
  it("recognises realistic behavioural answers", () => {
    const samples: Record<string, string> = {
      "hr-intro": "I am a final year B.Tech student in computer science. I have built two projects, a placement portal in React and Node and a chat app, and I did a summer internship on backend APIs. I am interested in backend development and I am looking for a software engineer role where I can contribute and keep learning.",
      "hr-failure": "In my second year I failed to submit a project on time because I underestimated the work. It was my mistake, I did not plan the tasks. After that I started breaking work into weekly goals and using a planner, and since then I have submitted every project early. The lesson was to plan early.",
      "hr-conflict": "During our final year project a teammate and I disagreed about the database. I listened to his reasons, then I suggested we compare both options with a small test. We agreed on PostgreSQL, the project was delivered on time and we still work well together. I learned to discuss with data.",
      "hr-challenge": "The hardest problem was a slow API in my internship project. First I profiled the queries and found a missing index on the orders table. I added the index and cached one query, which reduced the response time from 2 seconds to 200 milliseconds. I learned to measure before optimising.",
    };
    for (const [id, text] of Object.entries(samples)) {
      const q = hr.find((x) => x.id === id)!;
      expect(scoreAnswer(q, text).score, id).toBeGreaterThanOrEqual(60);
    }
  });
  it("has no concept that its own model answer misses (every term set is reachable)", () => {
    const missed: string[] = [];
    for (const q of tech) {
      const r = scoreAnswer(q, q.modelAnswer);
      for (const c of r.concepts) if (!c.hit) missed.push(`${q.id}: ${c.label}`);
    }
    expect(missed).toEqual([]);
  });
});

describe("answer scoring", () => {
  const acid = tech.find((q) => q.id === "db-acid")!;
  it("rewards a good answer and gives a short note on what was covered", () => {
    const r = scoreAnswer(acid, "Atomicity means a transaction is all or nothing. Consistency keeps the database in a valid state. Isolation means concurrent transactions do not interfere, and durability means committed data survives a crash. For example a bank transfer.");
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.verdict).toBe("strong");
  });
  it("gives partial credit for partial answers", () => {
    const r = scoreAnswer(acid, "ACID has atomicity, which means all or nothing, and durability, which means data stays after a crash.");
    expect(r.score).toBeGreaterThan(25);
    expect(r.score).toBeLessThan(75);
    expect(r.concepts.filter((c) => c.hit).map((c) => c.label)).toEqual(["Atomicity", "Durability"]);
  });
  it("gives zero for empty, tiny or off-topic answers", () => {
    expect(scoreAnswer(acid, "").score).toBe(0);
    expect(scoreAnswer(acid, "i dont know").score).toBe(0);
    expect(scoreAnswer(acid, "I like cricket and my favourite food is biryani because it is tasty and spicy always").score).toBe(0);
    expect(scoreAnswer(acid, tech.find((q) => q.id === "cn-tcp-udp")!.modelAnswer).score).toBeLessThan(20);
  });
  it("does not let a list of keywords earn a high score", () => {
    const stuffed = "atomicity consistency isolation durability";
    expect(scoreAnswer(acid, stuffed).score).toBeLessThan(40);
    const longer = "atomicity consistency isolation durability transaction database";
    expect(scoreAnswer(acid, longer).score).toBeLessThan(65);
  });
  it("matches word forms and ignores case and hyphens", () => {
    const q = tech.find((x) => x.id === "ds-stack-queue")!;
    const r = scoreAnswer(q, "A STACK is Last-In First-Out and is used for undo. A queue is first in first out, used for scheduling.");
    expect(r.concepts.every((c) => c.hit)).toBe(true);
  });
  it("scores a behavioural answer by structure, ownership and specifics", () => {
    const q = hr.find((x) => x.id === "hr-teamwork")!;
    const good = scoreAnswer(q, "During my final year project, our team of four had to build a placement portal in six weeks. My role was the backend, so I designed the database and wrote the APIs. I also organised daily standups when we fell behind. As a result we delivered on time and scored 92% in the review.");
    const vague = scoreAnswer(q, "I am a good team player and I like working with people in a team");
    expect(good.score).toBeGreaterThanOrEqual(70);
    expect(vague.score).toBeLessThan(good.score - 25);
    expect(good.notes.join(" ")).not.toMatch(/Too brief/);
    expect(vague.notes.join(" ")).toMatch(/Too brief/);
  });
  it("does not give a high score to a good story that answers a different question", () => {
    const story = "During my final year project our team of four had to build a placement portal in six weeks. My role was the backend, so I designed the database and wrote the APIs myself. When we fell behind I organised daily standups. As a result we delivered on time and scored 92% in the review.";
    for (const id of ["hr-ethics", "hr-conflict", "hr-failure", "hr-weakness", "hr-feedback"]) {
      expect(scoreAnswer(hr.find((x) => x.id === id)!, story).score, id).toBeLessThan(60);
    }
  });
  it("tells the candidate to say I rather than we", () => {
    const q = hr.find((x) => x.id === "hr-teamwork")!;
    const r = scoreAnswer(q, "During our college project we built an app and we decided the design together and we tested it and we delivered the result on time and we all learned a lot from it.");
    expect(r.notes.join(" ")).toMatch(/"I"/);
  });
  it("is deterministic and fast", () => {
    const t0 = Date.now();
    for (let i = 0; i < 300; i++) scoreAnswer(acid, "Atomicity and durability are two properties. ".repeat(40));
    expect(Date.now() - t0).toBeLessThan(500);
    expect(scoreAnswer(acid, "Atomicity is all or nothing.")).toEqual(scoreAnswer(acid, "Atomicity is all or nothing."));
  });
});

describe("question selection", () => {
  it("plans kinds for each interview type", () => {
    expect(planKinds("TECHNICAL", 5)).toEqual(Array(5).fill("TECHNICAL"));
    expect(planKinds("HR", 4)).toEqual(Array(4).fill("HR"));
    for (const n of [3, 5, 8, 10]) {
      const k = planKinds("MIXED", n);
      expect(k.length).toBe(n);
      expect(k.filter((x) => x === "HR").length).toBe(Math.max(1, Math.round(n * 0.4)));
      expect(k.some((x) => x === "TECHNICAL")).toBe(true);
    }
  });
  it("never repeats a question and respects the kind", () => {
    for (const kind of ["TECHNICAL", "HR"] as const) {
      const asked: string[] = [];
      const n = kind === "HR" ? hr.length : 12;
      for (let i = 0; i < n; i++) {
        const q = pickQuestion({ kind, asked, lastScores: [], base: "MEDIUM", skills: new Set(["Java"]), seed: "7" })!;
        expect(q.kind).toBe(kind);
        expect(asked).not.toContain(q.id);
        asked.push(q.id);
      }
      expect(pickQuestion({ kind, asked: INTERVIEW_QUESTIONS.filter((q) => q.kind === kind).map((q) => q.id), lastScores: [], base: "EASY", skills: new Set(), seed: "1" })).toBeNull();
    }
  });
  it("is reproducible per seed and varies between seeds", () => {
    const pick = (seed: string) => pickQuestion({ kind: "TECHNICAL", asked: [], lastScores: [], base: "MEDIUM", skills: new Set(), seed })!.id;
    expect(pick("a")).toBe(pick("a"));
    expect(new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(pick)).size).toBeGreaterThan(2);
  });
  it("prefers the user's skills", () => {
    const picks = ["1", "2", "3", "4", "5", "6"].map((seed) => pickQuestion({ kind: "TECHNICAL", asked: [], lastScores: [], base: "MEDIUM", skills: new Set(["Python"]), seed })!);
    expect(picks.filter((q) => q.skills.includes("Python")).length).toBeGreaterThanOrEqual(3);
  });
  it("adapts difficulty to recent scores and stays in range", () => {
    expect(targetDifficulty("MEDIUM", [])).toBe("MEDIUM");
    expect(targetDifficulty("MEDIUM", [90, 80])).toBe("HARD");
    expect(targetDifficulty("HARD", [95, 95])).toBe("HARD");
    expect(targetDifficulty("MEDIUM", [10, 20])).toBe("EASY");
    expect(targetDifficulty("EASY", [0, 0])).toBe("EASY");
    expect(targetDifficulty("MEDIUM", [90, 20])).toBe("MEDIUM");
  });
  it("asks harder questions after strong answers", () => {
    const easy = pickQuestion({ kind: "TECHNICAL", asked: [], lastScores: [10, 10], base: "MEDIUM", skills: new Set(), seed: "z" })!;
    const hard = pickQuestion({ kind: "TECHNICAL", asked: [], lastScores: [95, 90], base: "MEDIUM", skills: new Set(), seed: "z" })!;
    expect(easy.difficulty).toBe("EASY");
    expect(hard.difficulty).toBe("HARD");
  });
});

describe("report", () => {
  const rec = (q: InterviewQuestion, answer: string, skipped = false): AnswerRecord => ({
    questionId: q.id, answer, skipped, seconds: 40, result: skipped ? skippedResult(q) : scoreAnswer(q, answer),
  });
  const q1 = tech.find((q) => q.id === "db-acid")!;
  const q2 = tech.find((q) => q.id === "cn-tcp-udp")!;
  const q3 = hr.find((q) => q.id === "hr-teamwork")!;

  it("averages per question, counts skips as zero and separates technical from behavioural", () => {
    const r = buildReport([rec(q1, q1.modelAnswer), rec(q2, "", true), rec(q3, q3.modelAnswer)], 4);
    const expected = Math.round((r.questions[0].score + 0 + r.questions[2].score) / 3);
    expect(r.overallScore).toBe(expected);
    expect(r.completion).toEqual({ planned: 4, answered: 2, skipped: 1 });
    expect(r.technicalScore).toBe(Math.round(r.questions[0].score / 2));
    expect(r.behavioralScore).toBe(r.questions[2].score);
    expect(r.improvements.join(" ")).toMatch(/skipped/i);
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.questions[0].modelAnswer).toBe(q1.modelAnswer);
  });
  it("points weak topics at something to study", () => {
    const r = buildReport([rec(q1, "I think it is about databases and stuff, maybe something about safety of data in a bank system")], 1);
    expect(r.overallScore).toBeLessThan(40);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.recommendations.map((x) => x.text).join(" ")).toMatch(/Revise/);
    expect(r.readiness).toBe("Needs more practice");
  });
  it("gives null for a section that was not asked", () => {
    const r = buildReport([rec(q1, q1.modelAnswer)], 1);
    expect(r.behavioralScore).toBeNull();
    expect(r.readiness).toBe("Interview ready");
  });
});
