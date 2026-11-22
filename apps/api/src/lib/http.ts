import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { sign, verify } from "hono/jwt";
import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import { drizzle } from "drizzle-orm/d1";

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  PASSWORD_PEPPER: string;
  ALLOWED_ORIGINS?: string; // comma separated, for the dev proxy
  // Optional AI assistant (off unless AI_ENABLED is "true" and at least one key is set as a secret).
  AI_ENABLED?: string;
  AI_PROVIDERS?: string; // comma separated order, for example "gemini,groq,openrouter"
  AI_DAILY_LIMIT?: string;
  // Cloudflare Workers AI binding (free daily allowance, no key). Optional: absent when not configured.
  AI?: { run(model: string, inputs: unknown): Promise<unknown> };
  WORKERSAI_MODEL?: string; WORKERSAI_VISION_MODEL?: string;
  AI_SITE_DAILY_LIMIT?: string; AI_MINUTE_LIMIT?: string; AI_BREAKER_SECONDS?: string;
  GEMINI_API_KEY?: string; GEMINI_MODEL?: string; GEMINI_BASE_URL?: string;
  GROQ_API_KEY?: string; GROQ_MODEL?: string; GROQ_BASE_URL?: string;
  OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string; OPENROUTER_BASE_URL?: string;
};
export type Vars = { userId: number };
export type AppEnv = { Bindings: Bindings; Variables: Vars };

export const COOKIE = "pw_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export const getDb = (c: Context<AppEnv>) => drizzle(c.env.DB);

// Errors use the same shape the old Spring backend used: the frontend reads `message`.
export const httpError = (status: 400 | 401 | 403 | 404 | 409 | 429 | 502, message: string) =>
  new HTTPException(status, { message });

export const errorBody = (status: number, message: string) => ({
  status,
  error: status >= 500 ? "Internal Server Error" : "Error",
  message,
});

export async function startSession(c: Context<AppEnv>, userId: number, email: string, sessionVersion = 1) {
  const token = await sign(
    { sub: String(userId), email, sv: sessionVersion, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS },
    c.env.JWT_SECRET,
    "HS256",
  );
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export const endSession = (c: Context<AppEnv>) => deleteCookie(c, COOKIE, { path: "/" });

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) throw httpError(401, "Authentication required");
  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    const userId = Number(payload.sub);
    // One indexed read per request: lets "log out of all devices" and account deactivation take effect at once.
    const row = await c.env.DB.prepare("SELECT session_version AS sv, is_active AS active FROM users WHERE id = ?").bind(userId).first<{ sv: number; active: number }>();
    if (!row || !row.active || row.sv !== (typeof payload.sv === "number" ? payload.sv : 1)) throw new Error("revoked");
    c.set("userId", userId);
  } catch {
    throw httpError(401, "Session expired or invalid");
  }
  await next();
};

// CSRF defence in depth (cookie is SameSite=Lax): reject cross-origin state-changing requests.
export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return next();
  const origin = c.req.header("Origin");
  if (origin) {
    const allowed = (c.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const sameOrigin = origin === new URL(c.req.url).origin;
    if (!sameOrigin && !allowed.includes(origin)) throw httpError(403, "Cross-origin request blocked");
  }
  await next();
};

export const validate = <T extends ZodType>(target: "json", schema: T) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
      throw httpError(400, `${where}${issue?.message ?? "Invalid request"}`);
    }
  });
