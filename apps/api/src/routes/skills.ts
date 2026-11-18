import { Hono } from "hono";
import { asc } from "drizzle-orm";
import { skills } from "../db/schema";
import { type AppEnv, getDb, requireAuth } from "../lib/http";

export const skillRoutes = new Hono<AppEnv>();
skillRoutes.use("*", requireAuth);

// Iteration 4 adds POST /analyze and GET /gap-analysis here (deterministic, no AI).
skillRoutes.get("/", async (c) => {
  const rows = await getDb(c).select().from(skills).orderBy(asc(skills.category), asc(skills.name));
  return c.json(rows);
});
