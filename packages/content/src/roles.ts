// Role profiles: what a campus-placement resume for each role should show.
// Weight 3 = core, 2 = important, 1 = nice to have. `anyOf` means "at least one of these".
// Skill names must exist in skills-taxonomy.ts (enforced by a test). Also used by the skill-gap module.

export type RoleSkill =
  | { skill: string; weight: 1 | 2 | 3 }
  | { anyOf: string[]; label: string; weight: 1 | 2 | 3 };

export type RoleProfile = {
  id: string;
  title: string;
  /** Words that signal the role in a headline, summary, project or job title. */
  titleKeywords: string[];
  skills: RoleSkill[];
};

const LANGS = ["Java", "Python", "C++", "JavaScript", "C#", "Go", "Kotlin"];

export const ROLES: RoleProfile[] = [
  {
    id: "software-engineer",
    title: "Software Engineer",
    titleKeywords: ["software engineer", "software developer", "sde"],
    skills: [
      { anyOf: LANGS, label: "a programming language (Java, Python, C++ ...)", weight: 3 },
      { skill: "Data Structures", weight: 3 },
      { skill: "Algorithms", weight: 3 },
      { skill: "Object-Oriented Programming", weight: 3 },
      { skill: "Git", weight: 2 },
      { skill: "SQL", weight: 2 },
      { skill: "REST APIs", weight: 2 },
      { skill: "Operating Systems", weight: 1 },
      { skill: "DBMS", weight: 1 },
      { skill: "Computer Networks", weight: 1 },
      { skill: "System Design", weight: 1 },
      { skill: "Unit Testing", weight: 1 },
      { skill: "Problem Solving", weight: 2 },
    ],
  },
  {
    id: "backend-developer",
    title: "Backend Developer",
    titleKeywords: ["backend", "back-end", "back end", "server-side", "api developer"],
    skills: [
      { anyOf: ["Java", "Python", "Node.js", "Go", "C#", "PHP"], label: "a backend language (Java, Python, Node.js ...)", weight: 3 },
      { anyOf: ["Spring Boot", "Django", "Flask", "FastAPI", "Express.js", "ASP.NET", "NestJS", "Laravel"], label: "a backend framework (Spring Boot, Django, Express ...)", weight: 3 },
      { skill: "REST APIs", weight: 3 },
      { anyOf: ["MySQL", "PostgreSQL", "MongoDB", "SQL Server", "Oracle Database"], label: "a database (MySQL, PostgreSQL, MongoDB ...)", weight: 3 },
      { skill: "SQL", weight: 2 },
      { skill: "Git", weight: 2 },
      { skill: "Authentication", weight: 2 },
      { skill: "Docker", weight: 2 },
      { skill: "Database Design", weight: 1 },
      { skill: "Microservices", weight: 1 },
      { skill: "Redis", weight: 1 },
      { skill: "AWS", weight: 1 },
      { skill: "Unit Testing", weight: 1 },
      { skill: "Data Structures", weight: 2 },
    ],
  },
  {
    id: "frontend-developer",
    title: "Frontend Developer",
    titleKeywords: ["frontend", "front-end", "front end", "ui developer", "web developer"],
    skills: [
      { skill: "HTML", weight: 3 },
      { skill: "CSS", weight: 3 },
      { skill: "JavaScript", weight: 3 },
      { anyOf: ["React", "Angular", "Vue.js", "Next.js"], label: "a frontend framework (React, Angular, Vue ...)", weight: 3 },
      { skill: "TypeScript", weight: 2 },
      { skill: "Git", weight: 2 },
      { skill: "Responsive Design", weight: 2 },
      { skill: "REST APIs", weight: 2 },
      { skill: "Tailwind CSS", weight: 1 },
      { skill: "Redux", weight: 1 },
      { skill: "Accessibility", weight: 1 },
      { skill: "Unit Testing", weight: 1 },
      { skill: "Figma", weight: 1 },
    ],
  },
  {
    id: "full-stack-developer",
    title: "Full Stack Developer",
    titleKeywords: ["full stack", "full-stack", "fullstack", "mern", "mean"],
    skills: [
      { skill: "JavaScript", weight: 3 },
      { anyOf: ["React", "Angular", "Vue.js", "Next.js"], label: "a frontend framework (React, Angular, Vue ...)", weight: 3 },
      { anyOf: ["Node.js", "Spring Boot", "Django", "Flask", "FastAPI", "Express.js", "ASP.NET"], label: "a backend framework (Node.js, Spring Boot, Django ...)", weight: 3 },
      { anyOf: ["MySQL", "PostgreSQL", "MongoDB", "SQL Server"], label: "a database (MySQL, PostgreSQL, MongoDB ...)", weight: 3 },
      { skill: "HTML", weight: 2 },
      { skill: "CSS", weight: 2 },
      { skill: "REST APIs", weight: 3 },
      { skill: "Git", weight: 2 },
      { skill: "Authentication", weight: 1 },
      { skill: "Docker", weight: 1 },
      { skill: "TypeScript", weight: 1 },
      { skill: "Data Structures", weight: 1 },
    ],
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    titleKeywords: ["data analyst", "business analyst", "analytics", "bi developer"],
    skills: [
      { skill: "SQL", weight: 3 },
      { skill: "Excel", weight: 3 },
      { skill: "Data Analysis", weight: 3 },
      { skill: "Data Visualization", weight: 3 },
      { anyOf: ["Python", "R"], label: "Python or R", weight: 2 },
      { skill: "Pandas", weight: 2 },
      { skill: "Statistics", weight: 2 },
      { skill: "NumPy", weight: 1 },
      { skill: "Matplotlib", weight: 1 },
      { skill: "ETL", weight: 1 },
      { skill: "Communication", weight: 1 },
    ],
  },
  {
    id: "data-scientist",
    title: "Data Scientist / ML Engineer",
    titleKeywords: ["data scientist", "machine learning", "ml engineer", "ai engineer", "deep learning"],
    skills: [
      { skill: "Python", weight: 3 },
      { skill: "Machine Learning", weight: 3 },
      { skill: "Statistics", weight: 3 },
      { skill: "Pandas", weight: 2 },
      { skill: "NumPy", weight: 2 },
      { anyOf: ["TensorFlow", "PyTorch", "Keras"], label: "a deep learning framework (TensorFlow, PyTorch)", weight: 2 },
      { skill: "SQL", weight: 2 },
      { skill: "Data Visualization", weight: 1 },
      { skill: "Deep Learning", weight: 2 },
      { skill: "NLP", weight: 1 },
      { skill: "Computer Vision", weight: 1 },
      { skill: "Git", weight: 1 },
      { skill: "Big Data", weight: 1 },
    ],
  },
  {
    id: "devops-engineer",
    title: "DevOps / Cloud Engineer",
    titleKeywords: ["devops", "cloud engineer", "site reliability", "sre", "platform engineer"],
    skills: [
      { skill: "Linux", weight: 3 },
      { skill: "Docker", weight: 3 },
      { skill: "CI/CD", weight: 3 },
      { anyOf: ["AWS", "Azure", "Google Cloud"], label: "a cloud platform (AWS, Azure, GCP)", weight: 3 },
      { skill: "Kubernetes", weight: 2 },
      { skill: "Git", weight: 2 },
      { skill: "Bash", weight: 2 },
      { skill: "Terraform", weight: 1 },
      { skill: "Monitoring", weight: 1 },
      { skill: "Computer Networks", weight: 1 },
      { anyOf: ["Python", "Go", "Bash"], label: "a scripting language (Python, Bash, Go)", weight: 2 },
    ],
  },
  {
    id: "mobile-developer",
    title: "Mobile App Developer",
    titleKeywords: ["android", "ios", "mobile developer", "mobile app", "flutter", "react native"],
    skills: [
      { anyOf: ["Android", "iOS", "React Native", "Flutter"], label: "a mobile platform (Android, iOS, Flutter, React Native)", weight: 3 },
      { anyOf: ["Kotlin", "Java", "Swift", "Dart", "JavaScript"], label: "a mobile language (Kotlin, Java, Swift, Dart)", weight: 3 },
      { skill: "REST APIs", weight: 2 },
      { skill: "Git", weight: 2 },
      { skill: "Firebase", weight: 1 },
      { skill: "SQLite", weight: 1 },
      { skill: "Object-Oriented Programming", weight: 2 },
      { skill: "Design Patterns", weight: 1 },
      { skill: "Figma", weight: 1 },
    ],
  },
  {
    id: "qa-engineer",
    title: "QA / Test Engineer",
    titleKeywords: ["qa", "quality assurance", "test engineer", "sdet", "tester"],
    skills: [
      { skill: "Manual Testing", weight: 3 },
      { skill: "Test Automation", weight: 3 },
      { skill: "API Testing", weight: 2 },
      { skill: "SQL", weight: 2 },
      { anyOf: ["Java", "Python", "JavaScript"], label: "a programming language for automation", weight: 2 },
      { skill: "Agile", weight: 2 },
      { skill: "Jira", weight: 1 },
      { skill: "Git", weight: 1 },
      { skill: "CI/CD", weight: 1 },
      { skill: "Unit Testing", weight: 1 },
    ],
  },
];

export const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));

/** Every skill name a role mentions (for validation and the skill-gap module). */
export function roleSkillNames(role: RoleProfile): string[] {
  return role.skills.flatMap((s) => ("skill" in s ? [s.skill] : s.anyOf));
}
