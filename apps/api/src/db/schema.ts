import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

// Profile columns that clients may edit (shared by the update route and the response mapper).
export const PROFILE_TEXT_FIELDS = [
  "phone", "avatarUrl", "degree", "branch", "currentSemester", "education", "college",
  "targetRole", "targetCompany", "preferredIndustry", "placementStatus", "expectedPackage",
  "preferredLocation", "jobType", "githubUrl", "linkedinUrl", "portfolioUrl", "resumeUrl",
  "certifications", "targetCompaniesData", "settingsData", "careerGoal", "bio",
] as const;
