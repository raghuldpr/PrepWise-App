import { PROJECTS, type Project } from "@prepwise/content";

export type ProjectQuery = {
  language?: string;
  domain?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  fullStackRequired?: boolean;
  roleId?: string | null;
  /** Skills the user is missing for their target role; projects that teach them rank higher. */
  missingSkills?: string[];
  limit?: number;
};
export type RankedProject = { project: Project; score: number; reasons: string[] };

const RANK = { EASY: 0, MEDIUM: 1, HARD: 2 } as const;
const norm = (s: string) => s.trim().toLowerCase();

/** Deterministic ranking: every point can be explained to the user. */
export function rankProjects(q: ProjectQuery): RankedProject[] {
  const missing = new Set(q.missingSkills ?? []);
  const lang = q.language ? norm(q.language) : "";
  const domain = q.domain ? norm(q.domain) : "";

  // "full-stack required" is a hard filter: showing a backend-only project would not answer the request
  const pool = q.fullStackRequired ? PROJECTS.filter((p) => p.fullStack) : PROJECTS;
  const ranked = pool.map((project): RankedProject => {
    let score = 0;
    const reasons: string[] = [];

    if (lang && lang !== "any") {
      if (project.languages.some((l) => norm(l) === lang)) { score += 3; reasons.push(`Uses ${q.language}`); }
      else score -= 1;
    }
    if (domain && domain !== "any") {
      if (norm(project.domain) === domain) { score += 3; reasons.push(`In ${project.domain}`); }
    }
    if (q.difficulty) {
      const d = Math.abs(RANK[project.difficulty] - RANK[q.difficulty]);
      if (d === 0) { score += 2; reasons.push(`${project.difficulty.toLowerCase()} difficulty, as requested`); }
      else if (d === 1) score += 0.5;
      else score -= 1;
    }
    if (q.fullStackRequired) { score += 2; reasons.push("Full-stack: frontend, backend and database"); }
    if (q.roleId && project.roles.includes(q.roleId)) { score += 2; reasons.push("Fits your target role"); }

    const closes = project.skills.filter((s) => missing.has(s));
    if (closes.length) {
      score += Math.min(4, closes.length * 1.5);
      reasons.push(`Builds skills you are missing: ${closes.slice(0, 3).join(", ")}`);
    }
    return { project, score, reasons };
  });

  return ranked
    .sort((a, b) => b.score - a.score || a.project.id - b.project.id)
    .slice(0, q.limit ?? 6);
}
