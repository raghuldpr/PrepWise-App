import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppEnv, errorBody, originGuard } from "./lib/http";
import { authRoutes } from "./routes/auth";
import { onboardingRoutes } from "./routes/onboarding";
import { skillRoutes } from "./routes/skills";
import { userRoutes } from "./routes/users";

const app = new Hono<AppEnv>();

app.use("/api/*", originGuard);
app.get("/api/health", (c) => c.json({ status: "ok", runtime: "workers" }));
app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api/onboarding", onboardingRoutes);
app.route("/api/skills", skillRoutes);

app.notFound((c) => c.json(errorBody(404, "Not found"), 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json(errorBody(err.status, err.message), err.status);
  console.error(err);
  return c.json(errorBody(500, "Something went wrong"), 500);
});

export default app;
