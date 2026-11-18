import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { profiles, users } from "../db/schema";
import { dummyVerify, hashPassword, verifyPassword } from "../lib/password";
import { type AppEnv, endSession, getDb, httpError, requireAuth, startSession, validate } from "../lib/http";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  email: z.string().trim().toLowerCase().email("Invalid email format").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: z.string().min(1, "Password is required").max(200),
});

const authBody = (u: typeof users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  onboardingCompleted: u.onboardingCompleted,
});

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", validate("json", registerSchema), async (c) => {
  const { name, email, password } = c.req.valid("json");
  const db = getDb(c);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw httpError(409, "Email is already registered");

  const passwordHash = await hashPassword(password, c.env.PASSWORD_PEPPER);
  let user: typeof users.$inferSelect;
  try {
    [user] = await db.insert(users).values({ name, email, passwordHash }).returning();
  } catch {
    // Unique index race on email
    throw httpError(409, "Email is already registered");
  }
  // Profile rows are also created lazily (ensureProfile), so a failure here is harmless.
  await db.insert(profiles).values({ userId: user.id }).onConflictDoNothing();

  await startSession(c, user.id, user.email, user.sessionVersion);
  return c.json(authBody(user), 201);
});

authRoutes.post("/login", validate("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = getDb(c);
  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user || !user.isActive) {
    await dummyVerify(password, c.env.PASSWORD_PEPPER);
    throw httpError(401, "Invalid email or password");
  }
  // Locked after repeated failures. Checked before the password work, so a locked account also costs no CPU.
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000));
    throw httpError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
  const ok = await verifyPassword(password, c.env.PASSWORD_PEPPER, user.passwordHash);
  if (!ok) {
    const failures = user.failedLogins + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await db.update(users).set({
      failedLogins: lock ? 0 : failures,
      lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : user.lockedUntil,
    }).where(eq(users.id, user.id));
    throw httpError(lock ? 429 : 401, lock ? `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` : "Invalid email or password");
  }
  if (user.failedLogins > 0 || user.lockedUntil) await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));

  await startSession(c, user.id, user.email, user.sessionVersion);
  return c.json(authBody(user));
});

authRoutes.post("/logout", (c) => {
  endSession(c);
  return c.json({ message: "Logged out" });
});

// Ends every session of this account, on every device (including this one).
authRoutes.post("/logout-all", requireAuth, async (c) => {
  await getDb(c).update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, c.get("userId")));
  endSession(c);
  return c.json({ message: "Logged out of all devices" });
});
