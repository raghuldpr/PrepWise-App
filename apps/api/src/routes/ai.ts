import { Hono } from "hono";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { analyzeGap, availableProviders, blockUntil, buildMessages, referenceNote, checkImage, ChainError, contextNote, runChain, SYSTEM_PROMPT, titleFrom, type Attempt, type ChatTurn, type Fetch } from "@prepwise/core";
import { passageById, KIND_LABEL } from "../../../../packages/content/src/rag-corpus";
import { aiConversations, aiMessages } from "../db/schema";
import { aiEnabled, breakerSeconds, configuredProviders, dailyLimit, minuteLimit, siteDailyLimit } from "../lib/aiProviders";
import { loadEvidence, resolveRole } from "../lib/evidence";
import { type AppEnv, getDb, httpError, requireAuth, validate } from "../lib/http";

// Optional assistant. It is off unless the owner sets AI_ENABLED and at least one provider key. Everything else in
// PrepWise works without it. Keys live only in Worker secrets; the browser never sees them.

export const aiRoutes = new Hono<AppEnv>();
aiRoutes.use("*", requireAuth);

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 60; // per conversation
const HISTORY_TURNS = 4; // earlier messages sent to the provider (fewer tokens stretch the free quotas)
const MAX_TEXT = 4000;

const chatSchema = z.object({
  conversationId: z.number().int().positive().nullish(),
  message: z.string().trim().min(1, "Write a message").max(MAX_TEXT, `Keep the message under ${MAX_TEXT} characters`),
  image: z.object({ mimeType: z.string().max(30), dataBase64: z.string().max(1_400_000) }).nullish(),
  shareContext: z.boolean().default(false),
  // Ids of study passages the browser found (TF-IDF search runs there). The server rebuilds the text itself.
  sourceIds: z.array(z.string().max(100)).max(5).default([]),
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
  return c.json({
    ...row,
    messages: messages.map((m) => {
      let sources: unknown[] = [];
      try { sources = m.sourcesJson ? JSON.parse(m.sourcesJson) : []; } catch { /* a malformed value just shows no citations */ }
      const { sourcesJson: _omit, ...rest } = m;
      return { ...rest, sources };
    }),
  });
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
  if ((recent?.n ?? 0) >= minuteLimit(c.env)) throw httpError(429, `Slow down: at most ${minuteLimit(c.env)} messages a minute.`);

  // all students together: stop before the free provider quotas run out for everyone
  const siteLimit = siteDailyLimit(c.env);
  const site = await c.env.DB.prepare("SELECT count FROM ai_site_usage WHERE day = ?").bind(today()).first<{ count: number }>();
  if ((site?.count ?? 0) >= siteLimit) throw httpError(429, "The assistant has reached its free daily limit across all students. It resets at midnight UTC.");

  // circuit breaker: skip providers that recently reported an exhausted quota instead of waiting for them to fail again
  const breakerSecs = breakerSeconds(c.env);
  const blockedRows = breakerSecs > 0
    ? (await c.env.DB.prepare("SELECT provider, blocked_until AS until FROM ai_provider_state").all<{ provider: string; until: string }>()).results
    : [];
  const blocked = Object.fromEntries(blockedRows.map((r) => [r.provider, Date.parse(r.until) || 0]));
  const usable = availableProviders(providers, blocked, Date.now());
  if (usable.length === 0) throw httpError(502, "Every AI provider is out of quota for the moment; they are skipped for a few minutes after a limit. Try again shortly.");
  const recordBlocks = async (attempts: Attempt[]) => {
    const t = Date.now();
    for (const a of attempts) {
      const until = blockUntil(a, t, breakerSecs);
      if (until) {
        await c.env.DB.prepare(
          "INSERT INTO ai_provider_state (provider, blocked_until, reason, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(provider) DO UPDATE SET blocked_until = excluded.blocked_until, reason = excluded.reason, updated_at = excluded.updated_at",
        ).bind(a.provider, new Date(until).toISOString(), a.reason ?? null, new Date(t).toISOString()).run();
      }
    }
  };

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

  // retrieved study passages: looked up by id on the server, so a client cannot invent a "source"
  const sources = [...new Set(body.sourceIds)].map((id) => passageById(id)).filter((p): p is NonNullable<typeof p> => !!p);
  if (sources.length) system = `${system}

${referenceNote(sources.map((p) => ({ kind: KIND_LABEL[p.kind], title: p.title, text: p.text })))}`;
  const citations = sources.map((p, i) => ({ n: i + 1, id: p.id, kind: p.kind, title: p.title, link: p.link }));

  // count the attempt before calling out, so a retry loop cannot burn the provider quota
  await c.env.DB.prepare(
    "INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1",
  ).bind(userId, today()).run();
  await c.env.DB.prepare(
    "INSERT INTO ai_site_usage (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1",
  ).bind(today()).run();
  const refund = async () => {
    await c.env.DB.prepare("UPDATE ai_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND day = ?").bind(userId, today()).run();
    await c.env.DB.prepare("UPDATE ai_site_usage SET count = MAX(0, count - 1) WHERE day = ?").bind(today()).run();
  };

  let result;
  try {
    result = await runChain(usable, buildMessages(system, history, body.message, body.image ?? undefined), !!body.image, fetch as unknown as Fetch);
  } catch (err) {
    await refund();
    if (err instanceof ChainError) {
      await recordBlocks(err.attempts);
      const tried = err.attempts.map((a) => `${a.provider}: ${a.reason ?? "failed"}`).join("; ");
      throw httpError(502, `${err.message}${tried ? ` (${tried})` : ""}`);
    }
    throw err;
  }

  await recordBlocks(result.attempts); // a provider that failed on the way to this answer may need a rest
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
    { conversationId: conversation.id, role: "assistant", content: result.text, provider: result.provider, model: result.model, sourcesJson: citations.length ? JSON.stringify(citations) : null },
  ]);

  return c.json({
    conversationId: conversation.id,
    reply: { content: result.text, provider: result.provider, model: result.model, sources: citations },
    fellBack: result.attempts.length > 1,
    attempts: result.attempts.map((a) => ({ provider: a.provider, ok: a.ok, reason: a.reason })),
    usedToday: await usedToday(c),
    dailyLimit: limit,
  });
});
