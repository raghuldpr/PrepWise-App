import { describe, expect, it } from "vitest";
import { buildMessages, callProvider, ChainError, checkImage, contextNote, runChain, titleFrom, type Fetch, type ProviderConfig } from "./index";

const P = (id: string, over: Partial<ProviderConfig> = {}): ProviderConfig => ({ id, baseUrl: `https://${id}.test/v1/`, model: `${id}-model`, apiKey: `key-${id}`, vision: true, ...over });
const ok = (text: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }), text: async () => text });
const fail = (status: number) => ({ ok: false, status, json: async () => ({ error: { message: "secret provider detail key-gemini" } }), text: async () => "boom" });
const MSGS = buildMessages("sys", [], "hi");

/** A fake fetch keyed by hostname that records calls. */
function fake(map: Record<string, () => unknown>) {
  const calls: { url: string; body: any; auth: string }[] = [];
  const f: Fetch = async (url, init) => {
    const host = new URL(url).hostname.split(".")[0];
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const r = map[host]();
    if (r instanceof Error) throw r;
    return r as any;
  };
  return { f, calls };
}

describe("provider chain", () => {
  it("uses the first provider when it works and calls the right URL with its own key and model", async () => {
    const { f, calls } = fake({ gemini: () => ok("hello"), groq: () => ok("no") });
    const r = await runChain([P("gemini"), P("groq")], MSGS, false, f);
    expect(r).toMatchObject({ text: "hello", provider: "gemini", model: "gemini-model" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://gemini.test/v1/chat/completions");
    expect(calls[0].auth).toBe("Bearer key-gemini");
    expect(calls[0].body.model).toBe("gemini-model");
    expect(r.attempts).toEqual([expect.objectContaining({ provider: "gemini", ok: true })]);
  });
  it("falls back on rate limits, server errors, rejected keys and network failures, in order", async () => {
    const { f, calls } = fake({ gemini: () => fail(429), groq: () => new Error("ECONNRESET"), openrouter: () => ok("third time lucky") });
    const r = await runChain([P("gemini"), P("groq"), P("openrouter")], MSGS, false, f);
    expect(r.provider).toBe("openrouter");
    expect(calls.map((c) => new URL(c.url).hostname.split(".")[0])).toEqual(["gemini", "groq", "openrouter"]);
    expect(r.attempts.map((a) => [a.provider, a.ok, a.reason])).toEqual([["gemini", false, "rate limited"], ["groq", false, "network error"], ["openrouter", true, undefined]]);
    for (const status of [401, 403, 404, 400, 500, 503]) {
      const { f: g } = fake({ a: () => fail(status), b: () => ok("fine") });
      expect((await runChain([P("a"), P("b")], MSGS, false, g)).provider).toBe("b");
    }
  });
  it("falls back on an empty reply and on a malformed body", async () => {
    const { f } = fake({ a: () => ok("   "), b: () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }), text: async () => "" }), c: () => ok("x") });
    const r = await runChain([P("a"), P("b"), P("c")], MSGS, false, f);
    expect(r.provider).toBe("c");
    expect(r.attempts[0].reason).toBe("empty reply");
  });
  it("times out a slow provider and moves on", async () => {
    const f: Fetch = (url, init) => new Promise((resolve, reject) => {
      if (url.includes("slow")) init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      else resolve(ok("fast") as any);
    });
    const r = await runChain([P("slow"), P("fast")], MSGS, false, f, { timeoutMs: 30 });
    expect(r.provider).toBe("fast");
    expect(r.attempts[0].reason).toBe("timed out");
  });
  it("throws a ChainError listing every attempt without leaking keys or provider bodies", async () => {
    const { f } = fake({ gemini: () => fail(500), groq: () => fail(429) });
    const err = await runChain([P("gemini"), P("groq")], MSGS, false, f).catch((e) => e);
    expect(err).toBeInstanceOf(ChainError);
    expect(err.attempts).toHaveLength(2);
    const text = JSON.stringify({ m: err.message, a: err.attempts });
    expect(text).not.toMatch(/key-|secret provider detail/);
  });
  it("skips providers without a key, and providers that cannot read images when there is one", async () => {
    const { f, calls } = fake({ a: () => ok("a"), b: () => ok("b"), c: () => ok("c") });
    expect((await runChain([P("a", { apiKey: "" }), P("b")], MSGS, false, f)).provider).toBe("b");
    expect((await runChain([P("a", { vision: false }), P("c")], MSGS, true, f)).provider).toBe("c");
    expect(calls.map((c) => new URL(c.url).hostname.split(".")[0])).toEqual(["b", "c"]);
    await expect(runChain([P("a", { vision: false })], MSGS, true, f)).rejects.toThrow(/read images/);
    await expect(runChain([], MSGS, false, f)).rejects.toThrow(/No AI provider/);
  });
  it("sends images as data URLs and keeps history in order", async () => {
    const { f, calls } = fake({ a: () => ok("seen") });
    const msgs = buildMessages("sys", [{ role: "user", content: "q1" }, { role: "assistant", content: "a1" }], "what is this?", { mimeType: "image/png", dataBase64: "AAAA" });
    await runChain([P("a")], msgs, true, f);
    const sent = calls[0].body.messages;
    expect(sent.map((m: any) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(sent[3].content).toEqual([{ type: "text", text: "what is this?" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }]);
  });
  it("accepts providers that return content as parts", async () => {
    const f: Fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: [{ text: "part one " }, { text: "part two" }] } }] }), text: async () => "" });
    expect((await callProvider(P("a"), MSGS, f, 1000)).text).toBe("part one part two");
  });
});

describe("image checks", () => {
  const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
  const jpeg = b64([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
  const png = b64([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13]);
  const webp = b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  it("accepts real signatures", () => {
    expect(checkImage({ mimeType: "image/jpeg", dataBase64: jpeg })).toBeNull();
    expect(checkImage({ mimeType: "image/png", dataBase64: png })).toBeNull();
    expect(checkImage({ mimeType: "image/webp", dataBase64: webp })).toBeNull();
  });
  it("rejects wrong types, mismatched signatures, bad base64 and oversize data", () => {
    expect(checkImage({ mimeType: "image/gif", dataBase64: jpeg })).toMatch(/JPEG, PNG or WebP/);
    expect(checkImage({ mimeType: "image/png", dataBase64: jpeg })).toMatch(/does not match/);
    expect(checkImage({ mimeType: "image/jpeg", dataBase64: "not base64!!" })).toMatch(/not valid base64/);
    expect(checkImage({ mimeType: "image/jpeg", dataBase64: "abc" })).toMatch(/not valid base64/);
    expect(checkImage({ mimeType: "image/jpeg", dataBase64: jpeg + "A".repeat(1_400_000) })).toMatch(/too large/);
    expect(checkImage({ mimeType: "image/png", dataBase64: btoa("<svg onload=alert(1)>") })).toMatch(/does not match/);
  });
});

describe("prompt helpers", () => {
  it("shares only role and skill names, capped", () => {
    const note = contextNote("Backend Developer", ["Java"], Array.from({ length: 30 }, (_, i) => `S${i}`));
    expect(note).toMatch(/Backend Developer/);
    expect(note).toMatch(/S11/);
    expect(note).not.toMatch(/S12/);
    expect(contextNote(null, [], [])).toBe("");
  });
  it("makes short titles", () => {
    expect(titleFrom("  How do I   explain my project?  ")).toBe("How do I explain my project?");
    expect(titleFrom("x".repeat(100))).toHaveLength(60);
    expect(titleFrom("   ")).toBe("New conversation");
  });
});
