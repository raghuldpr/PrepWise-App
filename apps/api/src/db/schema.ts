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

// Profile columns that clients may edit (shared by the update route and the response mapper).
export const PROFILE_TEXT_FIELDS = [
  "phone", "avatarUrl", "degree", "branch", "currentSemester", "education", "college",
  "targetRole", "targetCompany", "preferredIndustry", "placementStatus", "expectedPackage",
  "preferredLocation", "jobType", "githubUrl", "linkedinUrl", "portfolioUrl", "resumeUrl",
  "certifications", "targetCompaniesData", "settingsData", "careerGoal", "bio",
] as const;
