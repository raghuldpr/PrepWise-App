// A fake OpenAI-compatible provider for testing the assistant and its fallback without real keys or quota.
// Behaviour depends on the API key it receives (see BEHAVIOUR) and can be changed at run time:
//   POST /__set  {"mock-or": "500"}
// Usage: node scripts/mock-ai-server.mjs [port]     then run the Worker with AI_ENABLED="true" and keys like
//   GEMINI_API_KEY=mock-gemini GROQ_API_KEY=mock-groq OPENROUTER_API_KEY=mock-or  and *_BASE_URL=http://localhost:8788/v1
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 8788);
const BEHAVIOUR = { "mock-gemini": "429", "mock-groq": "500", "mock-or": "ok" };
const log = [];

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", async () => {
    const send = (status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.method === "POST" && req.url === "/__set") { Object.assign(BEHAVIOUR, JSON.parse(body)); return send(200, BEHAVIOUR); }
    if (req.method === "GET" && req.url === "/__log") return send(200, log);
    if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) return send(404, { error: "not found" });

    const key = (req.headers.authorization ?? "").replace("Bearer ", "");
    const mode = BEHAVIOUR[key] ?? "401";
    const payload = JSON.parse(body);
    const msgs = payload.messages ?? [];
    const last = msgs[msgs.length - 1];
    const image = Array.isArray(last?.content) && last.content.some((p) => p.type === "image_url");
    const system = String(msgs[0]?.content ?? "");
    log.push({ key, mode, model: payload.model, n: msgs.length, image });
    if (mode === "429") return send(429, { error: { message: `rate limit for ${key}` } });
    if (mode === "500") return send(500, { error: { message: "internal boom" } });
    if (mode === "401") return send(401, { error: { message: "bad key" } });
    if (mode === "slow") { await new Promise((r) => setTimeout(r, 30000)); }
    if (mode === "empty") return send(200, { choices: [{ message: { content: "" } }] });
    const text = Array.isArray(last?.content) ? last.content.find((p) => p.type === "text")?.text : last?.content;
    send(200, { choices: [{ message: { content: `[${key}/${payload.model}] msgs=${msgs.length} image=${image} ctx=${system.includes("About the student")} refs=${(system.match(/\n\[\d\] \(/g) ?? []).length} marker=${system.includes("<<<REFERENCE_MATERIAL")} you said: ${String(text).slice(0, 60)}` } }] });
  });
});
server.listen(PORT, () => console.log(`mock AI provider on http://localhost:${PORT}/v1`));
