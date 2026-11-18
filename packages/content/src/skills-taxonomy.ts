// Skills taxonomy used by the resume analyzer and (in Iteration 4) the skill-gap module.
// Hand-curated for campus placements; no third-party dataset is copied.
// Line format:  Name | Category | alias, alias, ...      (aliases are matched case-insensitively)
// A trailing "!" on an alias means "ambiguous word": it only counts inside a skills-style list line
// (a line with 2+ commas, pipes, slashes or bullets), so e.g. "Go" in a sentence is not a skill.

const RAW = `
# Programming Languages
Java | Programming Languages | core java, java 8, java 11, java 17, java se
Python | Programming Languages | python3, python 3
C++ | Programming Languages | cpp, c plus plus
C | Programming Languages | c programming, c language, c!
C# | Programming Languages | c sharp, csharp
JavaScript | Programming Languages | js!, es6, es2015, ecmascript, vanilla js
TypeScript | Programming Languages | ts!
Go | Programming Languages | golang, go!
Rust | Programming Languages |
Kotlin | Programming Languages |
Swift | Programming Languages |
PHP | Programming Languages |
Ruby | Programming Languages | ruby on rails, rails!
R | Programming Languages | r programming, r language, r!
Scala | Programming Languages |
MATLAB | Programming Languages | matlab
Bash | Programming Languages | shell scripting, shell script, bash scripting, shell!
SQL | Programming Languages | structured query language, t-sql, tsql, pl/sql, plsql
Dart | Programming Languages |
# Web Frontend
HTML | Web Frontend | html5
CSS | Web Frontend | css3
React | Web Frontend | react.js, reactjs, react js
Angular | Web Frontend | angularjs, angular.js
Vue.js | Web Frontend | vue, vuejs, vue 3
Next.js | Web Frontend | nextjs, next js
Redux | Web Frontend | redux toolkit
Tailwind CSS | Web Frontend | tailwind, tailwindcss
Bootstrap | Web Frontend |
Sass | Web Frontend | scss
jQuery | Web Frontend |
Webpack | Web Frontend | vite!
Responsive Design | Web Frontend | responsive web design, mobile-first
Accessibility | Web Frontend | wcag, a11y, aria
# Backend & Frameworks
Node.js | Backend & Frameworks | nodejs, node js, node!
Express.js | Backend & Frameworks | expressjs, express js, express!
Spring Boot | Backend & Frameworks | springboot, spring-boot
Spring Framework | Backend & Frameworks | spring mvc, spring security, spring data
Hibernate | Backend & Frameworks | jpa, hibernate orm
Django | Backend & Frameworks | django rest framework, drf
Flask | Backend & Frameworks |
FastAPI | Backend & Frameworks | fast api
ASP.NET | Backend & Frameworks | asp.net core, .net core, dotnet, .net framework, .net!
Laravel | Backend & Frameworks |
NestJS | Backend & Frameworks | nest.js
GraphQL | Backend & Frameworks | graphql api
REST APIs | Backend & Frameworks | rest api, restful, restful api, restful apis, rest!
Microservices | Backend & Frameworks | micro-services, microservice architecture
Authentication | Backend & Frameworks | jwt, oauth, oauth2, session management
WebSockets | Backend & Frameworks | websocket, socket.io
Message Queues | Backend & Frameworks | kafka, rabbitmq, apache kafka, sqs
# Databases
MySQL | Databases | my sql
PostgreSQL | Databases | postgres, postgre sql
MongoDB | Databases | mongo, mongo db
SQLite | Databases |
Oracle Database | Databases | oracle db, oracle sql, oracle!
SQL Server | Databases | mssql, ms sql, microsoft sql server
Redis | Databases | redis cache
Firebase | Databases | firestore
DynamoDB | Databases | dynamo db
Elasticsearch | Databases | elastic search, elk stack
Database Design | Databases | database normalization, schema design, er diagram, er diagrams, normalization
# Cloud & DevOps
AWS | Cloud & DevOps | amazon web services, ec2, s3!, lambda!, aws lambda
Azure | Cloud & DevOps | microsoft azure
Google Cloud | Cloud & DevOps | gcp, google cloud platform
Docker | Cloud & DevOps | dockerfile, docker compose, containers!, containerization
Kubernetes | Cloud & DevOps | k8s, kubectl, helm
CI/CD | Cloud & DevOps | cicd, continuous integration, continuous delivery, continuous deployment, github actions, jenkins, gitlab ci
Terraform | Cloud & DevOps | infrastructure as code, iac
Linux | Cloud & DevOps | ubuntu!, unix, linux administration
Nginx | Cloud & DevOps | apache!
Monitoring | Cloud & DevOps | prometheus, grafana, datadog, observability
Serverless | Cloud & DevOps | cloudflare workers
# Data Science & AI
Machine Learning | Data Science & AI | ml!, scikit-learn, sklearn, supervised learning, unsupervised learning
Deep Learning | Data Science & AI | neural networks, cnn!, rnn!, lstm
NLP | Data Science & AI | natural language processing, nltk, spacy, text mining
Computer Vision | Data Science & AI | opencv, image processing, object detection
TensorFlow | Data Science & AI | tensorflow 2, tf!
PyTorch | Data Science & AI | torch!
Keras | Data Science & AI |
Pandas | Data Science & AI | dataframe, dataframes
NumPy | Data Science & AI | numpy arrays
Matplotlib | Data Science & AI | seaborn
Data Analysis | Data Science & AI | data analytics, exploratory data analysis, eda!, data cleaning, data wrangling
Data Visualization | Data Science & AI | tableau, power bi, powerbi, data visualisation, looker
Statistics | Data Science & AI | statistical analysis, hypothesis testing, regression, probability!
Excel | Data Science & AI | microsoft excel, ms excel, advanced excel, pivot tables, vlookup
Big Data | Data Science & AI | hadoop, spark, apache spark, pyspark
ETL | Data Science & AI | data pipelines, data pipeline, airflow, data warehousing
LLMs | Data Science & AI | large language models, generative ai, prompt engineering, langchain, openai api, rag!
# Mobile
Android | Mobile | android development, android studio, jetpack compose
iOS | Mobile | ios development, swiftui, xcode
React Native | Mobile | reactnative
Flutter | Mobile |
# Testing & Quality
Unit Testing | Testing & Quality | junit, jest, mocha, pytest, unit tests, unittest, testng
Test Automation | Testing & Quality | selenium, cypress, playwright, appium, automation testing
API Testing | Testing & Quality | postman, rest assured, restassured, swagger
Manual Testing | Testing & Quality | test cases, test plans, bug tracking, regression testing, functional testing
TDD | Testing & Quality | test driven development, test-driven development
Code Review | Testing & Quality | code reviews, pull requests
# Tools & Practices
Git | Tools & Practices | version control, git flow, gitflow
GitHub | Tools & Practices | gitlab, bitbucket
Agile | Tools & Practices | scrum, kanban, sprint planning, sprints
Jira | Tools & Practices | confluence
VS Code | Tools & Practices | visual studio code, intellij, eclipse, pycharm
Maven | Tools & Practices | gradle
npm | Tools & Practices | yarn, pnpm
Design Patterns | Tools & Practices | singleton, factory pattern, observer pattern, gof patterns
System Design | Tools & Practices | high level design, low level design, hld, lld, scalable systems, load balancing
Figma | Tools & Practices | ui/ux, ux design, wireframing, prototyping
Cybersecurity | Tools & Practices | owasp, penetration testing, network security, encryption, vulnerability assessment, cryptography
# CS Fundamentals
Data Structures | CS Fundamentals | data structure, dsa, arrays, linked list, linked lists, stacks, queues, trees!, graphs!, hash maps, hashmap, heaps
Algorithms | CS Fundamentals | dynamic programming, sorting algorithms, searching algorithms, recursion, backtracking, greedy algorithms, graph algorithms, time complexity, big o
Object-Oriented Programming | CS Fundamentals | oop, oops, object oriented programming, object-oriented design, ood, polymorphism, inheritance, encapsulation
Operating Systems | CS Fundamentals | os concepts, process scheduling, multithreading, concurrency, deadlock, deadlocks, memory management
DBMS | CS Fundamentals | database management systems, rdbms, acid properties
Computer Networks | CS Fundamentals | networking, tcp/ip, tcp ip, http, osi model, dns!
Problem Solving | CS Fundamentals | competitive programming, leetcode, codeforces, codechef, hackerrank, geeksforgeeks, problem-solving, coding challenges
# Soft Skills
Communication | Soft Skills | communication skills, presentation skills, public speaking, technical writing
Teamwork | Soft Skills | team player, collaboration, collaborated, cross-functional
Leadership | Soft Skills | team lead, led a team, mentoring, mentored, team leadership
Time Management | Soft Skills | project management, deadline, deadlines
Critical Thinking | Soft Skills | analytical skills, analytical thinking, logical reasoning
`;

export type TaxonomySkill = {
  name: string;
  category: string;
  /** Aliases that count anywhere in the text. */
  aliases: string[];
  /** Aliases that only count inside a skills-style list line (ambiguous common words). */
  listOnlyAliases: string[];
};

function parse(raw: string): TaxonomySkill[] {
  const skills: TaxonomySkill[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [name, category, aliasText = ""] = t.split("|").map((s) => s.trim());
    const aliases: string[] = [];
    const listOnlyAliases: string[] = [];
    for (const a of aliasText.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (a.endsWith("!")) listOnlyAliases.push(a.slice(0, -1).trim().toLowerCase());
      else aliases.push(a.toLowerCase());
    }
    // Names that are ordinary words/letters must only match inside skills lists (they carry a "!" alias).
    const nameAlias = ["c", "r", "go"].includes(name.toLowerCase()) ? [] : [name.toLowerCase()];
    skills.push({ name, category, aliases: [...new Set([...nameAlias, ...aliases])], listOnlyAliases: [...new Set(listOnlyAliases)] });
  }
  return skills;
}

export const SKILLS_TAXONOMY: TaxonomySkill[] = parse(RAW);
export const SKILL_NAMES = new Set(SKILLS_TAXONOMY.map((s) => s.name));
