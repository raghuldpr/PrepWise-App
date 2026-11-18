import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profiles, users } from "../db/schema";
import { dummyVerify, hashPassword, verifyPassword } from "../lib/password";
import { type AppEnv, endSession, getDb, httpError, startSession, validate } from "../lib/http";

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

  await startSession(c, user.id, user.email);
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
  const ok = await verifyPassword(password, c.env.PASSWORD_PEPPER, user.passwordHash);
  if (!ok) throw httpError(401, "Invalid email or password");

  await startSession(c, user.id, user.email);
  return c.json(authBody(user));
});

authRoutes.post("/logout", (c) => {
  endSession(c);
  return c.json({ message: "Logged out" });
});
