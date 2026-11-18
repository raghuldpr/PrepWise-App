import { describe, expect, it } from "vitest";
import {
  PROJECT_DOMAINS, PROJECTS, ROLE_BY_ID, ROLES, SEED_SKILL_MAP, SKILL_NAMES, STACK_PRESETS, TOPIC_BY_ID, TOPIC_FOR_SKILL, TOPICS,
} from "./index";

describe("learning topics", () => {
  it("have unique ids and valid fields", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    for (const t of TOPICS) {
      expect(["foundation", "core", "advanced"], t.id).toContain(t.level);
      expect(t.hours, t.id).toBeGreaterThan(0);
      expect(t.covers.length, t.id).toBeGreaterThan(0);
      expect(t.outline.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.practice.length, t.id).toBeGreaterThanOrEqual(1);
      for (const r of t.resources) expect(r.url, `${t.id}: ${r.title}`).toMatch(/^https:\/\/\S+$/);
    }
  });
  it("cover only skills that exist in the taxonomy", () => {
    for (const t of TOPICS) for (const s of t.covers) expect(SKILL_NAMES.has(s), `${t.id}: ${s}`).toBe(true);
  });
  it("have existing prerequisites and no cycles", () => {
    for (const t of TOPICS) for (const p of t.prerequisites) expect(TOPIC_BY_ID.has(p), `${t.id} -> ${p}`).toBe(true);
    const state = new Map<string, number>();
    const visit = (id: string, trail: string[]) => {
      if (state.get(id) === 2) return;
      expect(state.get(id) !== 1, `cycle: ${[...trail, id].join(" -> ")}`).toBe(true);
      state.set(id, 1);
      for (const p of TOPIC_BY_ID.get(id)!.prerequisites) visit(p, [...trail, id]);
      state.set(id, 2);
    };
    for (const t of TOPICS) visit(t.id, []);
  });
  it("never require a prerequisite from a later level", () => {
    const rank = { foundation: 0, core: 1, advanced: 2 } as const;
    for (const t of TOPICS) for (const p of t.prerequisites) expect(rank[TOPIC_BY_ID.get(p)!.level], `${t.id} <- ${p}`).toBeLessThanOrEqual(rank[t.level]);
  });
});

describe("role profiles are teachable", () => {
  it("every required skill (or at least one option of an any-of group) has a topic", () => {
    for (const r of ROLES) {
      for (const s of r.skills) {
        if ("skill" in s) expect(TOPIC_FOR_SKILL.has(s.skill), `${r.title}: ${s.skill}`).toBe(true);
        else expect(s.anyOf.some((n) => TOPIC_FOR_SKILL.has(n)), `${r.title}: ${s.label}`).toBe(true);
      }
    }
  });
  it("stack presets point at real roles and skills", () => {
    for (const [roleId, presets] of Object.entries(STACK_PRESETS)) {
      expect(ROLE_BY_ID.has(roleId), roleId).toBe(true);
      expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
      for (const p of presets) for (const s of p.skills) expect(SKILL_NAMES.has(s), `${roleId}/${p.id}: ${s}`).toBe(true);
    }
  });
  it("seed skill map targets exist in the taxonomy", () => {
    for (const [seed, names] of Object.entries(SEED_SKILL_MAP)) for (const n of names) expect(SKILL_NAMES.has(n), `${seed} -> ${n}`).toBe(true);
  });
});

describe("project catalog", () => {
  it("has unique ids and complete entries", () => {
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    expect(new Set(PROJECTS.map((p) => p.title)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) {
      expect(["EASY", "MEDIUM", "HARD"], p.title).toContain(p.difficulty);
      expect(PROJECT_DOMAINS as readonly string[], p.title).toContain(p.domain);
      expect(p.milestones.length, p.title).toBe(4);
      expect(p.features.length, p.title).toBeGreaterThanOrEqual(3);
      expect(p.problemStatement.length, p.title).toBeGreaterThan(60);
      expect(p.hours, p.title).toBeGreaterThan(0);
    }
  });
  it("reference valid skills and roles, and every role has at least two projects", () => {
    for (const p of PROJECTS) {
      for (const s of p.skills) expect(SKILL_NAMES.has(s), `${p.title}: ${s}`).toBe(true);
      for (const r of p.roles) expect(ROLE_BY_ID.has(r), `${p.title}: ${r}`).toBe(true);
    }
    for (const r of ROLES) expect(PROJECTS.filter((p) => p.roles.includes(r.id)).length, r.title).toBeGreaterThanOrEqual(2);
  });
});
