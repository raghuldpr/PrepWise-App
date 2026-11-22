import { describe, expect, it } from "vitest";
import { buildCorpus, passageById, PASSAGE_ID } from "../../../content/src/rag-corpus";
import { buildIndex, search, tokenize } from "./tfidf";

const corpus = buildCorpus();
const index = buildIndex(corpus);

// Each query is a student's question, with the passages that are a correct answer (any one counts).
// Written by the author, before tuning the tokeniser, and not used to train anything: it measures retrieval only.
const QUERIES: [string, string[]][] = [
  ["difference between a process and a thread", ["interview:os-process-thread"]],
  ["what is a deadlock and how can it be prevented", ["interview:os-deadlock"]],
  ["explain ACID properties of transactions", ["interview:db-acid"]],
  ["what is normalisation 1NF 2NF 3NF", ["interview:db-normalisation"]],
  ["how does a hash map handle collisions", ["interview:ds-hashmap"]],
  ["TCP versus UDP", ["interview:cn-tcp-udp"]],
  ["what are the four pillars of OOP", ["interview:oop-pillars", "topic:oop"]],
  ["abstract class vs interface", ["interview:oop-abstract-vs-interface"]],
  ["what is a closure in javascript", ["interview:js-closure"]],
  ["var let const in javascript", ["interview:js-var-let-const"]],
  ["how do I answer tell me about yourself", ["interview:hr-intro"]],
  ["what is your biggest weakness answer", ["interview:hr-weakness"]],
  ["difference between git merge and rebase", ["interview:git-merge-rebase"]],
  ["what is dependency injection in spring", ["interview:java-spring-di"]],
  ["what is the GIL in python", ["interview:py-gil"]],
  ["how does virtual memory and paging work", ["interview:os-paging"]],
  ["difference between mutex and semaphore", ["interview:os-semaphore-mutex"]],
  ["what is the box model in css", ["interview:web-html-semantic"]],
  ["explain big o notation complexity", ["interview:ds-complexity"]],
  ["how to design a url shortener", ["interview:sd-url-shortener"]],
  ["two sum problem", ["coding:two-sum"]],
  ["longest substring without repeating characters", ["coding:longest-substring-without-repeating"]],
  ["trapping rain water", ["coding:trapping-rain-water"]],
  ["fewest coins to make an amount", ["coding:coin-change"]],
  ["count islands in a grid", ["coding:number-of-islands"]],
  ["Kadane maximum subarray sum", ["coding:maximum-subarray"]],
  ["learn docker containers", ["topic:docker"]],
  ["roadmap for learning react", ["topic:react"]],
  ["what to study for operating systems", ["topic:os", "interview:os-process-thread", "interview:os-scheduling"]],
  ["learn sql basics", ["topic:sql-basics"]],
  ["kubernetes pods and deployments", ["topic:kubernetes"]],
  ["how to prepare for the networks subject", ["topic:networks"]],
];

function evaluate(k: number) {
  let hits = 0, rr = 0;
  const misses: string[] = [];
  for (const [q, expected] of QUERIES) {
    const ranked = search(index, q, { k: 10 }).map((h) => h.id);
    const pos = ranked.findIndex((id) => expected.includes(id));
    if (pos >= 0 && pos < k) hits++;
    rr += pos >= 0 ? 1 / (pos + 1) : 0;
    if (pos < 0 || pos >= k) misses.push(`${q} -> ${ranked.slice(0, 3).join(", ") || "nothing"}`);
  }
  return { recall: hits / QUERIES.length, mrr: rr / QUERIES.length, misses };
}

describe("study corpus", () => {
  it("has about 390 passages with unique, well-formed ids and links", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(380);
    expect(new Set(corpus.map((p) => p.id)).size).toBe(corpus.length);
    for (const p of corpus) {
      expect(p.id, p.id).toMatch(PASSAGE_ID);
      expect(p.title.length, p.id).toBeGreaterThan(2);
      expect(p.text.length, p.id).toBeGreaterThan(40);
      expect(p.text.length, p.id).toBeLessThanOrEqual(1200);
      expect(p.link, p.id).toMatch(/^\//);
    }
    for (const kind of ["topic", "interview", "question", "coding"]) expect(corpus.some((p) => p.kind === kind), kind).toBe(true);
  });
  it("never includes reference solutions", () => {
    for (const p of corpus.filter((x) => x.kind === "coding")) expect(p.text, p.id).not.toMatch(/function \w+\(|def \w+\(/);
  });
  it("looks passages up by id and rejects malformed ids", () => {
    expect(passageById("interview:db-acid")?.title).toMatch(/ACID/);
    expect(passageById("topic:docker")?.kind).toBe("topic");
    expect(passageById("coding:two-sum")?.link).toBe("/placement/coding/two-sum");
    expect(passageById("question:1")?.kind).toBe("question");
    expect(passageById("interview:nope")).toBeUndefined();
    for (const bad of ["", "x", "topic:", "topic:../etc", "other:1", "topic:a b", "interview:" + "x".repeat(200)]) expect(passageById(bad), bad).toBeUndefined();
    for (const p of corpus) expect(passageById(p.id)?.text, p.id).toBe(p.text);
  });
});

describe("tokenizer", () => {
  it("drops stop words, stems and keeps c, r and special tokens", () => {
    expect(tokenize("The difference between scheduling algorithms")).toEqual(tokenize("scheduling algorithm"));
    expect(tokenize("What is C++?")).toContain("cpp");
    expect(tokenize("learn R")).toContain("r");
    expect(tokenize("Node.js")).toEqual(tokenize("nodejs"));
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("TF-IDF search", () => {
  it("returns nothing for gibberish, empty or out-of-vocabulary queries", () => {
    expect(search(index, "")).toEqual([]);
    expect(search(index, "qwertyzzxx blorptastic")).toEqual([]);
    expect(search(index, "the of and")).toEqual([]);
  });
  it("is deterministic and sorted by score, with at most k hits and the matched terms", () => {
    const a = search(index, "deadlock prevention", { k: 4 });
    expect(a).toEqual(search(index, "deadlock prevention", { k: 4 }));
    expect(a.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < a.length; i++) expect(a[i - 1].score).toBeGreaterThanOrEqual(a[i].score);
    expect(a[0].terms).toContain("deadlock");
    expect(a.every((h) => h.score > 0 && h.score <= 1)).toBe(true);
  });
  it("finds a passage again from a copy of its own title (top 3; a practice question on the same topic may tie it)", () => {
    for (const id of ["interview:db-acid", "interview:os-deadlock", "coding:coin-change", "topic:docker", "interview:hr-intro"]) {
      const p = passageById(id)!;
      expect(search(index, p.title, { k: 3 }).map((h) => h.id), id).toContain(id);
    }
  });
  it("finds the right passage for realistic student questions", () => {
    const { recall, mrr, misses } = evaluate(3);
    // Report: printed so the numbers can be copied into the docs.
    console.log(`retrieval over ${corpus.length} passages, ${QUERIES.length} queries: recall@3 = ${(recall * 100).toFixed(0)}%, MRR = ${mrr.toFixed(3)}${misses.length ? `\n  misses:\n  ${misses.join("\n  ")}` : ""}`);
    expect(recall).toBeGreaterThanOrEqual(0.8);
    expect(mrr).toBeGreaterThanOrEqual(0.7);
  });
});
