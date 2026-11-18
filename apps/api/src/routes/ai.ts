import { Hono } from "hono";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { analyzeGap, buildMessages, checkImage, ChainError, contextNote, runChain, SYSTEM_PROMPT, titleFrom, type ChatTurn, type Fetch } from "@prepwise/core";
import { aiConversations, aiMessages } from "../db/schema";
import { aiEnabled, configuredProviders, dailyLimit, MINUTE_LIMIT } from "../lib/aiProviders";
import { loadEvidence, resolveRole } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

// Optional assistant. It is off unless the owner sets AI_ENABLED and at least one provider key. Everything else in
// PrepWise works without it. Keys live only in Worker secrets; the browser never sees them.

export const aiRoutes = new Hono<AppEnv>();
aiRoutes.use("*", requireAuth);

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 60; // per conversation
const HISTORY_TURNS = 10; // sent to the provider
const MAX_TEXT = 4000;

const chatSchema = z.object({
  conversationId: z.number().int().positive().nullish(),
  message: z.string().trim().min(1, "Write a message").max(MAX_TEXT, `Keep the message under ${MAX_TEXT} characters`),
  image: z.object({ mimeType: z.string().max(30), dataBase64: z.string().max(1_400_000) }).nullish(),
  shareContext: z.boolean().default(false),
});

const today = () => new Date().toISOString().slice(0, 10);

async function usedToday(c: Parameters<typeof getDb>[0]) {
  const row = await c.env.DB.prepare("SELECT count FROM ai_usage WHERE user_id = ? AND day = ?").bind(c.get("userId"), today()).first<{ count: number }>();
  return row?.count ?? 0;
}

aiRoutes.get("/status", async (c) => {
  const enabled = aiEnabled(c.env);
  const providers = configuredProviders(c.env);
  const available = enabled && providers.length > 0;
  return c.json({
    enabled: available,
    reason: !enabled ? "The AI assistant is turned off." : providers.length === 0 ? "No AI provider key is configured." : null,
    providers: available ? providers.map((p) => ({ id: p.id, model: p.model })) : [],
    dailyLimit: dailyLimit(c.env),
    usedToday: available ? await usedToday(c) : 0,
    maxImageKb: 1000,
  });
});

const conv = async (c: Parameters<typeof getDb>[0], id: number) => {
  const [row] = await getDb(c).select().from(aiConversations).where(and(eq(aiConversations.id, id), eq(aiConversations.userId, c.get("userId"))));
  if (!row) throw httpError(404, `Conversation not found with id: ${id}`);
  return row;
};
const idParam = (c: { req: { param: (k: string) => string } }) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) throw httpError(400, "Invalid id");
  return id;
};

aiRoutes.get("/conversations", async (c) => {
  const rows = await getDb(c).select().from(aiConversations).where(eq(aiConversations.userId, c.get("userId"))).orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id));
  return c.json(rows);
});

aiRoutes.get("/conversations/:id", async (c) => {
  const row = await conv(c, idParam(c));
  const messages = await getDb(c).select().from(aiMessages).where(eq(aiMessages.conversationId, row.id)).orderBy(asc(aiMessages.id));
  return c.json({ ...row, messages });
});

aiRoutes.delete("/conversations/:id", async (c) => {
  const row = await conv(c, idParam(c));
  await getDb(c).delete(aiConversations).where(eq(aiConversations.id, row.id));
  return c.json({ message: "Conversation deleted" });
});

aiRoutes.post("/chat", validate("json", chatSchema), async (c) => {
  const body = c.req.valid("json");
  const providers = configuredProviders(c.env);
  if (!aiEnabled(c.env) || providers.length === 0) throw httpError(403, "The AI assistant is not enabled on this site.");

  if (body.image) {
    const problem = checkImage(body.image);
    if (problem) throw httpError(400, problem);
  }

  const db = getDb(c);
  const userId = c.get("userId");
  const limit = dailyLimit(c.env);
  if ((await usedToday(c)) >= limit) throw httpError(429, `You have used your ${limit} assistant messages for today. It resets at midnight UTC.`);
  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ai_messages m JOIN ai_conversations v ON v.id = m.conversation_id
     WHERE v.user_id = ? AND m.role = 'user' AND m.created_at > ?`,
  ).bind(userId, new Date(Date.now() - 60_000).toISOString()).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MINUTE_LIMIT) throw httpError(429, "Slow down: at most 5 messages a minute.");

  // conversation and history
  let conversation = body.conversationId ? await conv(c, body.conversationId) : null;
  let history: ChatTurn[] = [];
  if (conversation) {
    const rows = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversation.id)).orderBy(desc(aiMessages.id)).limit(HISTORY_TURNS);
    if ((await db.select({ id: aiMessages.id }).from(aiMessages).where(eq(aiMessages.conversationId, conversation.id))).length >= MAX_MESSAGES) {
      throw httpError(400, "This conversation is full. Start a new one.");
    }
    history = rows.reverse().map((r) => ({ role: r.role, content: r.hadImage ? `${r.content}\n[an image was attached to this message]` : r.content }));
  }

  // optional grounding: role and skill names only, and only if the student ticked the box
  let system = SYSTEM_PROMPT;
  if (body.shareContext) {
    const { evidence, profileRole } = await loadEvidence(db, userId);
    const role = resolveRole(null, null, profileRole);
    if (role) {
      const gap = analyzeGap(role.id, evidence, []);
      const note = contextNote(gap.targetRole, gap.existingStrengths, [...gap.missingSkills, ...gap.skillsToImprove]);
      if (note) system = `${SYSTEM_PROMPT}\n\n${note}`;
    }
  }

  // count the attempt before calling out, so a retry loop cannot burn the provider quota
  await c.env.DB.prepare(
    "INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1",
  ).bind(userId, today()).run();
  const refund = () => c.env.DB.prepare("UPDATE ai_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND day = ?").bind(userId, today()).run();

  let result;
  try {
    result = await runChain(providers, buildMessages(system, history, body.message, body.image ?? undefined), !!body.image, fetch as unknown as Fetch);
  } catch (err) {
    await refund();
    if (err instanceof ChainError) {
      const tried = err.attempts.map((a) => `${a.provider}: ${a.reason ?? "failed"}`).join("; ");
      throw httpError(502, `${err.message}${tried ? ` (${tried})` : ""}`);
    }
    throw err;
  }

  const now = new Date().toISOString();
  if (!conversation) {
    [conversation] = await db.insert(aiConversations).values({ userId, title: titleFrom(body.message) }).returning();
    const keep = await db.select({ id: aiConversations.id }).from(aiConversations).where(eq(aiConversations.userId, userId)).orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id)).limit(MAX_CONVERSATIONS);
    await db.delete(aiConversations).where(and(eq(aiConversations.userId, userId), notInArray(aiConversations.id, keep.map((k) => k.id))));
  } else {
    await db.update(aiConversations).set({ updatedAt: now }).where(eq(aiConversations.id, conversation.id));
  }
  await db.insert(aiMessages).values([
    { conversationId: conversation.id, role: "user", content: body.message, hadImage: !!body.image },
    { conversationId: conversation.id, role: "assistant", content: result.text, provider: result.provider, model: result.model },
  ]);

  return c.json({
    conversationId: conversation.id,
    reply: { content: result.text, provider: result.provider, model: result.model },
    fellBack: result.attempts.length > 1,
    attempts: result.attempts.map((a) => ({ provider: a.provider, ok: a.ok, reason: a.reason })),
    usedToday: await usedToday(c),
    dailyLimit: limit,
  });
});
