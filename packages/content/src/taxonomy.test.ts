import { describe, expect, it } from "vitest";
import { ROLES, roleSkillNames, SKILL_NAMES, SKILLS_TAXONOMY } from "./index";

describe("skills taxonomy", () => {
  it("has unique names and no empty alias lists", () => {
    expect(new Set(SKILLS_TAXONOMY.map((s) => s.name)).size).toBe(SKILLS_TAXONOMY.length);
    for (const s of SKILLS_TAXONOMY) expect(s.aliases.length + s.listOnlyAliases.length, s.name).toBeGreaterThan(0);
  });

  it("does not let one-letter or common-word names match anywhere", () => {
    for (const n of ["C", "R", "Go"]) {
      const s = SKILLS_TAXONOMY.find((x) => x.name === n)!;
      expect(s.aliases, n).not.toContain(n.toLowerCase());
      expect(s.listOnlyAliases, n).toContain(n.toLowerCase());
    }
  });

  it("has no alias claimed by two skills (ambiguous matching)", () => {
    const seen = new Map<string, string>();
    for (const s of SKILLS_TAXONOMY) {
      for (const a of [...s.aliases, ...s.listOnlyAliases]) {
        expect(seen.has(a) ? `${a} is used by ${seen.get(a)} and ${s.name}` : "ok").toBe("ok");
        seen.set(a, s.name);
      }
    }
  });
});

describe("role profiles", () => {
  it("only reference skills that exist in the taxonomy", () => {
    for (const r of ROLES) for (const n of roleSkillNames(r)) expect(SKILL_NAMES.has(n), `${r.title}: ${n}`).toBe(true);
  });
  it("have unique ids and at least one core (weight 3) requirement", () => {
    expect(new Set(ROLES.map((r) => r.id)).size).toBe(ROLES.length);
    for (const r of ROLES) expect(r.skills.some((s) => s.weight === 3), r.title).toBe(true);
  });
});
