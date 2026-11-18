import { SKILLS_TAXONOMY, type TaxonomySkill } from "@prepwise/content";

export type FoundSkill = {
  name: string;
  category: string;
  count: number;
  /** true when the skill also appears outside a skills list (project / experience text) */
  demonstrated: boolean;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Compiled = { skill: TaxonomySkill; re: RegExp; listOnly: boolean };

// Boundaries treat + # . as part of a word so "c++" != "c", "node.js" != "js", ".net" is matched.
const compile = (alias: string) =>
  new RegExp(`(?<![a-z0-9+#.])${escapeRe(alias)}(?![a-z0-9+#])`, "g");

let COMPILED: Compiled[] | null = null;
function compiled(): Compiled[] {
  if (!COMPILED) {
    COMPILED = [];
    for (const skill of SKILLS_TAXONOMY) {
      for (const a of skill.aliases) COMPILED.push({ skill, re: compile(a), listOnly: false });
      for (const a of skill.listOnlyAliases) COMPILED.push({ skill, re: compile(a), listOnly: true });
    }
  }
  return COMPILED;
}

const isListLine = (line: string) => (line.match(/[,|/•·;\t]/g) ?? []).length >= 2;

function countIn(lines: string[], listLinesOnly: boolean, c: Compiled): number {
  let n = 0;
  for (const raw of lines) {
    const line = raw.toLowerCase();
    if (c.listOnly && !isListLine(raw)) continue;
    if (listLinesOnly && !isListLine(raw)) continue;
    c.re.lastIndex = 0;
    n += (line.match(c.re) ?? []).length;
  }
  return n;
}

/**
 * Finds taxonomy skills in the resume.
 * @param skillsLines lines of the Skills section (a mention there is "listed")
 * @param otherLines  everything else (a mention there is "demonstrated")
 */
export function extractSkills(skillsLines: string[], otherLines: string[]): FoundSkill[] {
  const bySkill = new Map<string, { skill: TaxonomySkill; listed: number; other: number }>();
  for (const c of compiled()) {
    const listed = countIn(skillsLines, false, c);
    const other = countIn(otherLines, false, c);
    if (!listed && !other) continue;
    const prev = bySkill.get(c.skill.name) ?? { skill: c.skill, listed: 0, other: 0 };
    prev.listed += listed;
    prev.other += other;
    bySkill.set(c.skill.name, prev);
  }
  return [...bySkill.values()]
    .map(({ skill, listed, other }) => ({ name: skill.name, category: skill.category, count: listed + other, demonstrated: other > 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Skills mentioned anywhere in a free text such as a job description (no listed/demonstrated split). */
export function skillsInText(text: string): FoundSkill[] {
  return extractSkills([], text.split("\n"));
}
