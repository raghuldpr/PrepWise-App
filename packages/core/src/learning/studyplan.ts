import type { Roadmap } from "./roadmap";

export type PlanTask = {
  id: string;
  day: string; // Mon..Sat
  text: string;
  hours: number;
  kind: "learn" | "practice" | "revision" | "project" | "mock";
};
export type PlanWeek = {
  weekNumber: number;
  focusTopic: string;
  hours: number;
  dailyTasks: PlanTask[];
  weeklyGoal: string;
};
export type StudyPlan = {
  version: string;
  title: string;
  roleId: string;
  targetRole: string;
  durationWeeks: number;
  hoursPerWeek: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  coverage: {
    requiredHours: number;
    plannedLearningHours: number;
    trimmed: string[];
    /** Only set when the roadmap does not fit: what it would take to fit everything. */
    neededWeeks?: number;
    neededHoursPerWeek?: number;
    note: string;
  };
  weeklySchedule: PlanWeek[];
};
export const STUDY_PLAN_VERSION = "1.1.0";

export type StudyPlanInput = {
  roadmap: Roadmap;
  weeks: number;
  hoursPerWeek: number;
  level?: StudyPlan["level"];
};

type Item = {
  title: string; hours: number; kind: "learn" | "project"; priority: number; position: number;
  outline: string[]; practice: string; resource?: string;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const SCALE = { Beginner: 1.25, Intermediate: 1, Advanced: 0.75 } as const;
const LEARN_SHARE = 0.65;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildStudyPlan(input: StudyPlanInput): StudyPlan {
  const W = Math.min(26, Math.max(1, Math.round(input.weeks)));
  const H = Math.min(60, Math.max(2, Math.round(input.hoursPerWeek)));
  const level = input.level ?? "Intermediate";
  const scale = SCALE[level];

  // Weekly budget that always adds up to H: learning, practice (aptitude + DSA), revision and mock.
  const learnCap = Math.max(1, Math.round(H * LEARN_SHARE));
  let practiceCap = Math.max(1, Math.round(H * 0.25));
  let reviewCap = H - learnCap - practiceCap;
  if (reviewCap < 0.5) { practiceCap = Math.max(0.5, practiceCap - (0.5 - reviewCap)); reviewCap = 0.5; }
  const mockHours = Math.min(1, reviewCap);

  // 1. flatten the roadmap into a queue (roadmap order = learning order)
  const items: Item[] = [];
  input.roadmap.phases.forEach((ph) => {
    for (const t of ph.topics) {
      items.push({
        title: t.title, hours: Math.max(2, Math.round(t.hours * scale)), kind: "learn", priority: t.priority, position: items.length,
        outline: t.outline, practice: t.practice[0] ?? "", resource: t.resources[0]?.title,
      });
    }
    for (const p of ph.projects) {
      items.push({
        title: `Project: ${p.title}`, hours: Math.max(4, Math.round(p.hours * scale)), kind: "project", priority: 1, position: items.length,
        outline: ["Plan the features and the data model", "Build the core feature", "Add the remaining features and tests", "Deploy it and write the README"], practice: "",
      });
    }
  });

  // 2. if it does not fit, drop the lowest-priority items first and, within a priority, the LATEST ones,
  //    so what remains is a coherent start of the roadmap.
  const capacity = W * learnCap;
  const required = items.reduce((s, i) => s + i.hours, 0);
  let kept = [...items];
  let total = required;
  const dropped: Item[] = [];
  for (const cand of [...items].sort((a, b) => a.priority - b.priority || b.position - a.position)) {
    if (total <= capacity) break;
    kept = kept.filter((i) => i !== cand);
    total -= cand.hours;
    dropped.push(cand);
  }
  // Dropping one large item can overshoot and leave hours unused: refill with the best dropped items that still fit.
  for (const cand of [...dropped].sort((a, b) => b.priority - a.priority || a.position - b.position)) {
    if (total + cand.hours <= capacity) {
      kept.push(cand);
      total += cand.hours;
      dropped.splice(dropped.indexOf(cand), 1);
    }
  }
  kept.sort((a, b) => a.position - b.position);
  const trimmed = dropped.sort((a, b) => a.position - b.position).map((d) => d.title).reverse();

  // 3. pour the kept items into weeks of `learnCap` hours
  type Chunk = { item: Item; from: number; hours: number }; // from = hours already done on this item
  const chunks: Chunk[][] = Array.from({ length: W }, () => []);
  let w = 0, room = learnCap;
  for (const item of kept) {
    let done = 0;
    while (done < item.hours - 1e-9 && w < W) {
      const take = Math.min(item.hours - done, room);
      chunks[w].push({ item, from: done, hours: take });
      done += take; room -= take;
      if (room <= 0.01) { w++; room = learnCap; }
    }
  }
  let learningWeeks = 0;
  chunks.forEach((c, i) => { if (c.length > 0) learningWeeks = i + 1; });

  // 4. turn each week into dated tasks
  const weeksOut: PlanWeek[] = [];
  for (let wk = 0; wk < W; wk++) {
    const n = wk + 1;
    const isLast = n === W;
    const tasks: PlanTask[] = [];
    const add = (day: string, text: string, hours: number, kind: PlanTask["kind"]) =>
      tasks.push({ id: `w${n}-t${tasks.length + 1}`, day, text, hours: r1(hours), kind });

    let di = 0;
    const learnPlanned = chunks[wk].reduce((s, c) => s + c.hours, 0);
    for (const c of chunks[wk]) {
      const { item } = c;
      const slot = item.hours / item.outline.length; // hours the topic spends on each outline point
      const first = Math.floor(c.from / slot + 1e-9);
      const last = Math.min(item.outline.length - 1, Math.floor((c.from + c.hours) / slot - 1e-9));
      for (let k = first; k <= last; k++) {
        const overlap = Math.max(0, Math.min(c.from + c.hours, (k + 1) * slot) - Math.max(c.from, k * slot));
        if (overlap < 0.25) continue;
        const sessions = Math.max(1, Math.ceil(overlap / 2.5));
        for (let s = 0; s < sessions; s++) {
          const hours = overlap / sessions;
          const part = item.outline[k];
          let text: string;
          let kind: PlanTask["kind"] = item.kind === "project" ? "project" : "learn";
          if (item.kind === "project") text = `Build: ${item.title.replace("Project: ", "")} — ${part}`;
          else if (s % 2 === 0) text = `Study: ${item.title} — ${part}${k === first && s === 0 && item.resource && c.from === 0 ? ` (start with: ${item.resource})` : ""}`;
          else { text = `Hands-on: write code or notes that apply "${part}"`; kind = "learn"; }
          add(DAYS[di % DAYS.length], sessions > 1 ? `${text} [${s + 1}/${sessions}]` : text, hours, kind);
          di++;
        }
      }
      if (c.from + c.hours >= item.hours - 1e-9 && item.practice) {
        // the checkpoint is part of the topic time, so take its half hour from the last session
        const prev = tasks[tasks.length - 1];
        if (prev && prev.hours >= 1) prev.hours = r1(prev.hours - 0.5);
        add(DAYS[di % DAYS.length], `Checkpoint for ${item.title}: ${item.practice}`, 0.5, "practice");
        di++;
      }
    }

    const spare = Math.max(0, learnCap - learnPlanned); // unused learning time becomes practice
    const polish = !isLast && spare >= 3 ? Math.min(spare - 1, 3) : 0;
    const practiceHours = practiceCap + spare - polish;
    const aptQs = Math.min(30, Math.max(5, Math.round(practiceCap * 4 + spare * 2)));
    const dsaProblems = Math.min(10, Math.max(2, Math.round(practiceCap + spare / 2)));

    if (isLast) {
      // the final week still has to respect the budget, including any learning that spills into it
      const base = Math.max(2, H - learnPlanned);
      const resumeH = 0.5;
      const mockH = Math.min(2, Math.max(1, (base - resumeH) / 3));
      const left = Math.max(0.5, base - resumeH - mockH);
      add("Fri", "Update your resume with what you learned, then run it through the Resume Analyzer", resumeH, "revision");
      add("Sat", "Take a full mock interview in PrepWise and read the report carefully", mockH, "mock");
      add("Sat", `Open Progress, find your 2 weakest categories and redo ${aptQs} questions there`, left / 2, "practice");
      add("Sat", `Solve ${dsaProblems} data-structure and algorithm problems you have not seen before`, left / 2, "practice");
    } else {
      add("Sat", `Solve ${aptQs} aptitude or core-subject questions in PrepWise and read every explanation`, practiceHours / 2, "practice");
      add("Sat", `Solve ${dsaProblems} data-structure and algorithm problems (LeetCode or NeetCode)`, practiceHours / 2, "practice");
      add("Sat", "Revise this week's notes and redo the questions you got wrong", Math.max(0.5, reviewCap - (n % 3 === 0 ? mockHours : 0)), "revision");
      if (n % 3 === 0) add("Sat", "Take one mock interview in PrepWise (30 to 45 minutes)", mockHours, "mock");
      if (polish > 0) add("Sun", "Polish your best project: README, screenshots, tests and a live link", polish, "project");
    }

    const names = [...new Set(chunks[wk].map((c) => c.item.title))];
    const focus = names.length ? names.slice(0, 2).join(" + ") + (names.length > 2 ? " + more" : "") : "Practice and revision";
    const checkpoints = chunks[wk].filter((c) => c.from + c.hours >= c.item.hours - 1e-9 && c.item.practice).map((c) => c.item.practice);
    const weeklyGoal = isLast
      ? "Be interview-ready: finish a full mock interview, fix the weak areas it shows, and update your resume."
      : names.length
        ? `Cover ${names.join(", ")}.${checkpoints.length ? ` Checkpoint: ${checkpoints[0]}.` : ""} Solve ${dsaProblems} problems.`
        : `Consolidate: reach 70% accuracy in your weakest categories and solve ${dsaProblems * 2} problems.`;

    weeksOut.push({ weekNumber: n, focusTopic: focus, hours: H, dailyTasks: tasks, weeklyGoal });
  }

  // 5. tell the user plainly whether it fits
  let neededWeeks: number | undefined;
  let neededHoursPerWeek: number | undefined;
  let note: string;
  if (trimmed.length) {
    neededWeeks = Math.ceil(required / learnCap);
    neededHoursPerWeek = Math.min(60, Math.ceil(required / (W * LEARN_SHARE)));
    note = `This roadmap needs about ${required} hours of study. ${W} weeks at ${H} h/week leaves room for ${Math.round(total)}. ` +
      `To cover everything you need about ${neededWeeks} weeks at ${H} h/week, or about ${neededHoursPerWeek} h/week for ${W} weeks. ` +
      `For now the plan keeps the highest-priority items in roadmap order and leaves out: ${trimmed.slice().reverse().join(", ")}.`;
  } else if (learningWeeks < W) {
    note = `You have more time than the roadmap needs, so the last ${W - learningWeeks} week(s) are practice, projects and revision.`;
  } else note = "The schedule fits the roadmap.";

  return {
    version: STUDY_PLAN_VERSION,
    title: `${W}-week plan for ${input.roadmap.targetRole}`,
    roleId: input.roadmap.roleId,
    targetRole: input.roadmap.targetRole,
    durationWeeks: W,
    hoursPerWeek: H,
    level,
    coverage: { requiredHours: required, plannedLearningHours: Math.round(total), trimmed, neededWeeks, neededHoursPerWeek, note },
    weeklySchedule: weeksOut,
  };
}
