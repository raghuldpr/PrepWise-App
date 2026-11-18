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
};
export type Vars = { userId: number };
export type AppEnv = { Bindings: Bindings; Variables: Vars };

export const COOKIE = "pw_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export const getDb = (c: Context<AppEnv>) => drizzle(c.env.DB);

// Errors use the same shape the old Spring backend used: the frontend reads `message`.
export const httpError = (status: 400 | 401 | 403 | 404 | 409, message: string) =>
  new HTTPException(status, { message });

export const errorBody = (status: number, message: string) => ({
  status,
  error: status >= 500 ? "Internal Server Error" : "Error",
  message,
});

export async function startSession(c: Context<AppEnv>, userId: number, email: string) {
  const token = await sign(
    { sub: String(userId), email, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS },
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
    c.set("userId", Number(payload.sub));
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
