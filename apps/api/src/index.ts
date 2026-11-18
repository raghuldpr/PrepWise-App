import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppEnv, errorBody, originGuard } from "./lib/http";
import { aiRoutes } from "./routes/ai";
import { analyticsRoutes } from "./routes/analytics";
import { attemptRoutes } from "./routes/attempts";
import { authRoutes } from "./routes/auth";
import { codingRoutes } from "./routes/coding";
import { companyRoutes } from "./routes/companies";
import { interviewRoutes } from "./routes/interviews";
import { progressRoutes } from "./routes/progress";
import { questionRoutes } from "./routes/questions";
import { projectRoutes } from "./routes/projects";
import { resumeRoutes } from "./routes/resume";
import { roadmapRoutes } from "./routes/roadmap";
import { studyPlanRoutes } from "./routes/studyPlan";
import { onboardingRoutes } from "./routes/onboarding";
import { skillRoutes } from "./routes/skills";
import { userRoutes } from "./routes/users";

const app = new Hono<AppEnv>();

app.use("/api/*", originGuard);
app.get("/api/health", (c) => c.json({ status: "ok", runtime: "workers" }));
app.route("/api/auth", authRoutes);
app.route("/api/users/analytics", analyticsRoutes); // before /api/users so it is matched first
app.route("/api/users", userRoutes);
app.route("/api/questions", questionRoutes);
app.route("/api/attempts", attemptRoutes);
app.route("/api/progress", progressRoutes);
app.route("/api/companies", companyRoutes);
app.route("/api/resume", resumeRoutes);
app.route("/api/roadmap", roadmapRoutes);
app.route("/api/study-plan", studyPlanRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/onboarding", onboardingRoutes);
app.route("/api/skills", skillRoutes);
app.route("/api/interviews", interviewRoutes);
app.route("/api/coding", codingRoutes);
app.route("/api/ai", aiRoutes);

app.notFound((c) => c.json(errorBody(404, "Not found"), 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json(errorBody(err.status, err.message), err.status);
  console.error(err);
  return c.json(errorBody(500, "Something went wrong"), 500);
});

export default app;
