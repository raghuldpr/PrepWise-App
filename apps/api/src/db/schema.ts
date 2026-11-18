import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["STUDENT", "ADMIN"] }).notNull().default("STUDENT"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    // Brute-force protection and "log out of all devices": bumping sessionVersion invalidates every issued cookie.
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: text("locked_until"),
    sessionVersion: integer("session_version").notNull().default(1),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const profiles = sqliteTable(
  "profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    degree: text("degree"),
    branch: text("branch"),
    currentSemester: text("current_semester"),
    education: text("education"),
    college: text("college"),
    graduationYear: integer("graduation_year"),
    targetRole: text("target_role"),
    targetCompany: text("target_company"),
    preferredIndustry: text("preferred_industry"),
    placementStatus: text("placement_status"),
    expectedPackage: text("expected_package"),
    preferredLocation: text("preferred_location"),
    jobType: text("job_type"),
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    portfolioUrl: text("portfolio_url"),
    resumeUrl: text("resume_url"),
    certifications: text("certifications"),
    targetCompaniesData: text("target_companies_data"),
    settingsData: text("settings_data"),
    careerGoal: text("career_goal"),
    bio: text("bio"),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("profiles_user_unique").on(t.userId)],
);

export const skills = sqliteTable(
  "skills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
  },
  (t) => [uniqueIndex("skills_name_unique").on(t.name)],
);

export const userSkills = sqliteTable(
  "user_skills",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    skillId: integer("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    proficiencyLevel: text("proficiency_level", { enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] })
      .notNull()
      .default("BEGINNER"),
  },
  (t) => [uniqueIndex("user_skills_unique").on(t.userId, t.skillId)],
);

export const MODULE_TYPES = ["APTITUDE", "CODING", "DSA", "TECHNICAL", "HR"] as const;
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const QUESTION_TYPES = ["MCQ", "CODING", "DESCRIPTIVE", "TECHNICAL", "HR"] as const;

export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    website: text("website"),
    industry: text("industry"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("companies_name_unique").on(t.name)],
);

export const questionCategories = sqliteTable("question_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  moduleType: text("module_type", { enum: MODULE_TYPES }).notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(now),
});

export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id").notNull().references(() => questionCategories.id, { onDelete: "cascade" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    questionText: text("question_text").notNull(),
    difficulty: text("difficulty", { enum: DIFFICULTIES }).notNull().default("MEDIUM"),
    questionType: text("question_type", { enum: QUESTION_TYPES }).notNull().default("MCQ"),
    topic: text("topic"),
    expectedAnswer: text("expected_answer"),
    explanation: text("explanation"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("questions_category_idx").on(t.categoryId), index("questions_company_idx").on(t.companyId)],
);

export const questionOptions = sqliteTable(
  "question_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    optionText: text("option_text").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("options_question_idx").on(t.questionId)],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questionId: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    selectedAnswer: text("selected_answer"),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
    // false for answer types we cannot grade yet (coding, free text); excluded from progress
    graded: integer("graded", { mode: "boolean" }).notNull().default(true),
    score: real("score").notNull().default(0),
    timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
    attemptedAt: text("attempted_at").notNull().default(now),
  },
  (t) => [index("attempts_user_idx").on(t.userId, t.attemptedAt), index("attempts_question_idx").on(t.questionId)],
);

export const progress = sqliteTable(
  "progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => questionCategories.id, { onDelete: "cascade" }),
    questionsAttempted: integer("questions_attempted").notNull().default(0),
    questionsCorrect: integer("questions_correct").notNull().default(0),
    accuracy: real("accuracy").notNull().default(0),
    averageScore: real("average_score").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("progress_user_category_unique").on(t.userId, t.categoryId)],
);

export const resumes = sqliteTable(
  "resumes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    fileType: text("file_type", { enum: ["pdf", "docx", "txt"] }).notNull(),
    fileSize: integer("file_size").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
    // Text is extracted in the browser; the original file is never uploaded or stored.
    textContent: text("text_content").notNull(),
    uploadedAt: text("uploaded_at").notNull().default(now),
  },
  (t) => [index("resumes_user_idx").on(t.userId, t.uploadedAt)],
);

export const resumeAnalyses = sqliteTable(
  "resume_analyses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    resumeId: integer("resume_id").notNull().references(() => resumes.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetRole: text("target_role").notNull(),
    targetRoleId: text("target_role_id"),
    jobDescription: text("job_description"),
    score: integer("score").notNull(),
    grade: text("grade").notNull(),
    resultJson: text("result_json").notNull(),
    analyzerVersion: text("analyzer_version").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("analyses_resume_idx").on(t.resumeId, t.createdAt), index("analyses_user_idx").on(t.userId, t.createdAt)],
);

export const skillGapAnalyses = sqliteTable(
  "skill_gap_analyses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    targetRole: text("target_role").notNull(),
    readiness: integer("readiness").notNull(),
    resultJson: text("result_json").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("gap_user_idx").on(t.userId, t.createdAt)],
);

export const learningRoadmaps = sqliteTable(
  "learning_roadmaps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    targetRole: text("target_role").notNull(),
    dataJson: text("data_json").notNull(),
    completedJson: text("completed_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("roadmaps_user_idx").on(t.userId, t.updatedAt)],
);

export const studyPlans = sqliteTable(
  "study_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    title: text("title").notNull(),
    targetRole: text("target_role").notNull(),
    durationWeeks: integer("duration_weeks").notNull(),
    dataJson: text("data_json").notNull(),
    completedJson: text("completed_json").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("plans_user_idx").on(t.userId, t.updatedAt)],
);

export const PROJECT_STATUSES = ["SAVED", "PLANNED", "IN_PROGRESS", "COMPLETED"] as const;
export const userProjects = sqliteTable(
  "user_projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // The catalog lives in code (packages/content), so this is an id, not a foreign key.
    projectId: integer("project_id").notNull(),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("SAVED"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("user_projects_unique").on(t.userId, t.projectId)],
);

export const INTERVIEW_TYPES = ["TECHNICAL", "HR", "MIXED"] as const;
export const interviews = sqliteTable(
  "interviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    interviewType: text("interview_type", { enum: INTERVIEW_TYPES }).notNull(),
    targetRole: text("target_role").notNull(),
    roleId: text("role_id"),
    companyName: text("company_name"),
    difficulty: text("difficulty", { enum: DIFFICULTIES }).notNull().default("MEDIUM"),
    questionCount: integer("question_count").notNull(),
    status: text("status", { enum: ["IN_PROGRESS", "COMPLETED"] }).notNull().default("IN_PROGRESS"),
    // The bank lives in code (packages/content), so questions are referenced by id inside JSON.
    planJson: text("plan_json").notNull(), // kind for each position
    answersJson: text("answers_json").notNull().default("[]"), // AnswerRecord[]
    reportJson: text("report_json"),
    overallScore: integer("overall_score"),
    createdAt: text("created_at").notNull().default(now),
    completedAt: text("completed_at"),
  },
  (t) => [index("interviews_user_idx").on(t.userId, t.createdAt)],
);

export const CODING_VERDICTS = ["Accepted", "Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Compile Error"] as const;
export const codingSubmissions = sqliteTable(
  "coding_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // The problem bank lives in code (packages/content), so this is a slug, not a foreign key.
    problemId: text("problem_id").notNull(),
    language: text("language", { enum: ["javascript", "python"] }).notNull(),
    verdict: text("verdict", { enum: CODING_VERDICTS }).notNull(),
    passed: integer("passed").notNull(),
    total: integer("total").notNull(),
    timeMs: integer("time_ms").notNull().default(0),
    code: text("code").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("coding_user_problem_idx").on(t.userId, t.problemId, t.createdAt)],
);

export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("ai_conv_user_idx").on(t.userId, t.updatedAt)],
);

// Text only: images are sent to the provider and never stored.
export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: integer("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    hadImage: integer("had_image", { mode: "boolean" }).notNull().default(false),
    provider: text("provider"),
    model: text("model"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("ai_msg_conv_idx").on(t.conversationId, t.id)],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // UTC date, YYYY-MM-DD
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("ai_usage_unique").on(t.userId, t.day)],
);

// Profile columns that clients may edit (shared by the update route and the response mapper).
export const PROFILE_TEXT_FIELDS = [
  "phone", "avatarUrl", "degree", "branch", "currentSemester", "education", "college",
  "targetRole", "targetCompany", "preferredIndustry", "placementStatus", "expectedPackage",
  "preferredLocation", "jobType", "githubUrl", "linkedinUrl", "portfolioUrl", "resumeUrl",
  "certifications", "targetCompaniesData", "settingsData", "careerGoal", "bio",
] as const;
