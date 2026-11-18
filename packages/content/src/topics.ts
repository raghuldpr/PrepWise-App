// Learning topics: the building blocks of roadmaps and study plans.
// Hand-curated. Resource links point to official documentation or long-established free courses.
// Line format (fields separated by " | ", list items by ";"):
//   id | title | level | hours | covers | prerequisites | outline | practice | resources (Title=URL)
// `covers` are taxonomy skill names; `level` orders the roadmap: foundation < core < advanced.
// Link health is checked by scripts/check-links.mjs.

const RAW = `
python-basics | Python fundamentals | foundation | 30 | Python | | Variables and data types;Control flow and functions;Lists, dicts and sets;File handling and exceptions;Modules and virtual environments | Solve 20 beginner problems on HackerRank Python;Write a CLI to-do app | Python tutorial=https://docs.python.org/3/tutorial/;CS50P=https://cs50.harvard.edu/python/
java-basics | Java fundamentals | foundation | 40 | Java | | Syntax, types and control flow;Classes and objects;Collections framework;Exceptions and generics;Streams and lambdas | Solve 20 problems using collections;Build a console banking app | Learn Java (dev.java)=https://dev.java/learn/;Java tutorials (W3Schools)=https://www.w3schools.com/java/
cpp-basics | C++ fundamentals | foundation | 40 | C++ | | Syntax and pointers;Functions and references;Classes and STL containers;Memory management;STL algorithms | Solve 20 problems using STL;Implement a linked list from scratch | Learn C++=https://www.learncpp.com/
js-basics | JavaScript fundamentals | foundation | 35 | JavaScript | | Variables, functions and scope;Arrays and objects;DOM and events;Promises and async/await;Modules and tooling | Build a to-do list in plain JavaScript;Fetch and render data from a public API | The Modern JavaScript Tutorial=https://javascript.info/;MDN web learning area=https://developer.mozilla.org/en-US/docs/Learn_web_development
html-css | HTML and CSS | foundation | 25 | HTML;CSS | | Semantic HTML;Box model and layout;Flexbox and Grid;Forms;Basic animations | Recreate a landing page from a screenshot;Build a responsive portfolio page | MDN web learning area=https://developer.mozilla.org/en-US/docs/Learn_web_development;web.dev Learn=https://web.dev/learn
responsive-design | Responsive design and accessibility | core | 12 | Responsive Design;Accessibility | html-css | Media queries and mobile-first;Fluid layouts;Semantic landmarks and ARIA;Keyboard and screen-reader testing | Make your portfolio fully responsive;Fix every issue Lighthouse reports | web.dev Learn=https://web.dev/learn
git-github | Git and GitHub | foundation | 8 | Git;GitHub | | Commits and branches;Merging and resolving conflicts;Pull requests;Open-source contribution flow | Push 3 projects to GitHub with clean history;Open a pull request on a practice repository | Pro Git book=https://git-scm.com/book/en/v2;Learn Git Branching=https://learngitbranching.js.org/
sql-basics | SQL | foundation | 20 | SQL | | SELECT, WHERE and ORDER BY;Joins;Aggregation and GROUP BY;Subqueries;Indexes and constraints | Solve 30 SQL problems;Design and query a small shop database | SQLBolt=https://sqlbolt.com/;PostgreSQL tutorial=https://www.postgresql.org/docs/current/tutorial.html
linux-basics | Linux and the command line | foundation | 15 | Linux;Bash | | Files and permissions;Processes and services;Pipes and text tools;Shell scripting;SSH | Write a backup script;Set up a small server on a free VM | Linux Journey=https://linuxjourney.com/;The Missing Semester=https://missing.csail.mit.edu/
dsa-basics | Data structures | core | 40 | Data Structures | | Arrays and strings;Linked lists;Stacks and queues;Hash maps;Trees and heaps;Graphs | Solve 40 easy and medium problems;Implement each structure from scratch | GeeksforGeeks DSA tutorial=https://www.geeksforgeeks.org/dsa/dsa-tutorial-learn-data-structures-and-algorithms/;NeetCode roadmap=https://neetcode.io/roadmap
algorithms | Algorithms | core | 40 | Algorithms | dsa-basics | Sorting and searching;Recursion and backtracking;Greedy methods;Dynamic programming;Graph algorithms;Time and space complexity | Solve 40 medium problems across patterns;Do 3 timed mock contests | CP-Algorithms=https://cp-algorithms.com/
problem-solving-practice | Daily problem solving | core | 40 | Problem Solving | dsa-basics | Two pointers and sliding window;Binary search patterns;Tree and graph traversal;Dynamic programming patterns | Solve one problem every day for 30 days;Track mistakes in a notebook | LeetCode=https://leetcode.com/problemset/;NeetCode=https://neetcode.io/
oop | Object-oriented programming | core | 20 | Object-Oriented Programming | | Classes and objects;Encapsulation and abstraction;Inheritance and polymorphism;Interfaces and composition;SOLID principles | Model a library system with classes;Refactor a script into classes | OOP in Java (dev.java)=https://dev.java/learn/oop/;Refactoring Guru=https://refactoring.guru/
design-patterns | Design patterns | advanced | 15 | Design Patterns | oop | Creational patterns;Structural patterns;Behavioural patterns;When not to use patterns | Implement Singleton, Factory and Observer;Identify patterns in a framework you use | Design patterns catalog=https://refactoring.guru/design-patterns
os | Operating systems | core | 25 | Operating Systems | | Processes and threads;CPU scheduling;Synchronisation and deadlocks;Memory management and paging;File systems | Simulate round-robin scheduling;Answer 30 OS interview questions | Operating Systems: Three Easy Pieces=https://pages.cs.wisc.edu/~remzi/OSTEP/;GeeksforGeeks OS=https://www.geeksforgeeks.org/operating-systems/operating-systems/
dbms | Databases and DBMS theory | core | 25 | DBMS;Database Design | sql-basics | ER modelling;Normalisation;Transactions and ACID;Indexing;Concurrency control | Normalise a messy table to 3NF;Answer 30 DBMS interview questions | GeeksforGeeks DBMS=https://www.geeksforgeeks.org/dbms/dbms/;CS186 Berkeley=https://cs186berkeley.net/
networks | Computer networks | core | 20 | Computer Networks | | OSI and TCP/IP layers;IP addressing and subnetting;TCP vs UDP;HTTP, HTTPS and DNS;Routing basics | Trace a web request end to end;Answer 30 networking interview questions | GeeksforGeeks computer networks=https://www.geeksforgeeks.org/computer-networks/computer-network-tutorials/;Computer Networking: A Top-Down Approach=https://gaia.cs.umass.edu/kurose_ross/index.php
system-design-basics | System design basics | advanced | 30 | System Design | dbms;networks | Scalability and load balancing;Caching;Database sharding and replication;Message queues;Designing a URL shortener | Design 5 classic systems on paper;Explain one design out loud in 20 minutes | System Design Primer=https://github.com/donnemartin/system-design-primer;roadmap.sh system design=https://roadmap.sh/system-design
spring-boot | Spring Boot | core | 35 | Spring Boot;Hibernate | java-basics;oop;sql-basics | Dependency injection;REST controllers;Spring Data JPA;Validation and error handling;Spring Security basics;Testing | Build a CRUD REST API with MySQL;Add JWT login to it | Spring guides=https://spring.io/guides;Spring Boot quickstart=https://spring.io/quickstart
node-express | Node.js and Express | core | 30 | Node.js;Express.js | js-basics | Node runtime and modules;Express routing and middleware;Connecting to a database;Error handling;Environment config | Build a REST API with Express and MongoDB;Deploy it to a free host | Node.js learn=https://nodejs.org/learn;Express guide=https://expressjs.com/en/starter/installing/
python-web | Python web frameworks | core | 30 | Django;Flask;FastAPI | python-basics | Routing and views;Models and ORM;Forms and validation;Authentication;API serialisation | Build a blog or REST API;Add tests for every endpoint | Django tutorial=https://docs.djangoproject.com/en/stable/intro/tutorial01/;Flask tutorial=https://flask.palletsprojects.com/en/stable/tutorial/;FastAPI tutorial=https://fastapi.tiangolo.com/tutorial/
rest-apis | REST API design | core | 15 | REST APIs | | HTTP methods and status codes;Resource design and versioning;Pagination and filtering;Error responses;API documentation | Design an API for a todo service;Document it with OpenAPI | HTTP on MDN=https://developer.mozilla.org/en-US/docs/Web/HTTP;REST API tutorial=https://restfulapi.net/
authentication | Authentication and security | core | 12 | Authentication;Cybersecurity | rest-apis | Password hashing;Sessions vs JWT;OAuth basics;OWASP top 10 | Add login and role checks to an API;Fix an XSS and an SQL-injection bug on purpose | JWT introduction=https://www.jwt.io/introduction;OWASP Top Ten=https://owasp.org/projects/top-ten
mysql-postgres | MySQL and PostgreSQL | core | 15 | MySQL;PostgreSQL | sql-basics | Installing and connecting;Data types and constraints;Joins and indexes in practice;Transactions;Backups | Move a project from SQLite to PostgreSQL;Explain a query plan | MySQL tutorial=https://dev.mysql.com/doc/refman/8.0/en/tutorial.html;PostgreSQL tutorial=https://www.postgresql.org/docs/current/tutorial.html
nosql-redis | MongoDB and Redis | core | 20 | MongoDB;Redis | | Documents and collections;Queries and aggregation;Schema design trade-offs;Caching with Redis;TTL and expiry | Store sessions in Redis;Model a blog in MongoDB | MongoDB University=https://learn.mongodb.com/;Redis University=https://university.redis.io/
microservices | Microservices and messaging | advanced | 25 | Microservices;Message Queues | rest-apis | Service boundaries;Service-to-service calls;Message queues and Kafka;API gateways;Observability | Split a monolith into 2 services;Add an event with a queue | Microservices patterns=https://microservices.io/patterns/index.html;Apache Kafka quickstart=https://kafka.apache.org/quickstart
unit-testing | Unit testing | core | 15 | Unit Testing;TDD;Code Review | | Test structure and assertions;Mocking;Test-driven development;Coverage;Reviewing code | Reach 70% coverage on one project;Write tests before a new feature | JUnit 5 guide=https://junit.org/junit5/docs/current/user-guide/;Jest=https://jestjs.io/docs/getting-started;pytest=https://docs.pytest.org/en/stable/getting-started.html
test-automation | Test automation | core | 25 | Test Automation;API Testing | | Locators and waits;Page objects;API testing with Postman;Running tests in CI;Reporting | Automate a login flow end to end;Build a Postman collection for an API | Playwright=https://playwright.dev/docs/intro;Selenium=https://www.selenium.dev/documentation/;Postman Learning Center=https://learning.postman.com/
manual-testing | Manual testing and QA process | foundation | 15 | Manual Testing | | Test cases and plans;Bug reports;Regression and smoke testing;Test techniques | Write 20 test cases for a real website;File 10 clear bug reports | Software testing (GeeksforGeeks)=https://www.geeksforgeeks.org/software-testing/software-testing-tutorial/
agile-tools | Agile and project tools | foundation | 8 | Agile;Jira | | Scrum roles and events;User stories;Sprint planning;Using Jira | Run a one-week sprint on a team project | Scrum Guide=https://scrumguides.org/scrum-guide.html
react | React | core | 40 | React;Redux | js-basics;html-css | Components and props;State and hooks;Routing;Forms;Data fetching;State management | Build a weather app;Build a task manager with a REST API | React docs=https://react.dev/learn
typescript | TypeScript | core | 20 | TypeScript | js-basics | Types and interfaces;Generics;Narrowing;Typing React and APIs | Convert a JavaScript project to TypeScript | TypeScript handbook=https://www.typescriptlang.org/docs/handbook/intro.html
tailwind | Tailwind CSS and UI kits | core | 10 | Tailwind CSS;Bootstrap;Sass | html-css | Utility classes;Responsive variants;Dark mode;Component libraries | Rebuild a page with Tailwind | Tailwind docs=https://tailwindcss.com/docs/installation/using-vite
nextjs | Next.js | advanced | 20 | Next.js | react | Routing;Server and client components;Data fetching;Deployment | Build and deploy a blog | Next.js Learn=https://nextjs.org/learn
angular | Angular | core | 40 | Angular | js-basics;typescript | Components and modules;Services and DI;Routing;Forms;HTTP and RxJS | Build a CRUD app against an API | Angular tutorials=https://angular.dev/tutorials
vue | Vue.js | core | 35 | Vue.js | js-basics | Components and reactivity;Directives;Routing;State management;API calls | Build a notes app | Vue tutorial=https://vuejs.org/tutorial/
figma | UI design with Figma | advanced | 10 | Figma | | Frames and auto layout;Components;Prototyping;Design handoff | Design and prototype a 3-screen app | Figma help center=https://help.figma.com/hc/en-us
docker | Docker | core | 15 | Docker | linux-basics | Images and containers;Dockerfiles;Volumes and networks;Docker Compose | Containerise a full-stack app with Compose | Docker get started=https://docs.docker.com/get-started/
ci-cd | CI/CD pipelines | core | 15 | CI/CD | git-github;docker | Pipelines and workflows;Running tests automatically;Building and pushing images;Deploying automatically | Add a GitHub Actions pipeline that tests and deploys a project | GitHub Actions docs=https://docs.github.com/en/actions
aws-basics | AWS fundamentals | core | 30 | AWS | | IAM and billing safety;EC2 and S3;Databases on RDS;Networking basics (VPC);Lambda | Deploy an app on EC2 and serve static files from S3 | AWS getting started=https://aws.amazon.com/getting-started/
azure | Microsoft Azure | core | 25 | Azure | | Resource groups;App Service and VMs;Storage and databases;Identity | Deploy a web app to Azure App Service | Azure documentation=https://learn.microsoft.com/en-us/azure/
gcp | Google Cloud | core | 25 | Google Cloud | | Projects and IAM;Compute and Cloud Run;Storage and databases;Monitoring | Deploy a container to Cloud Run | Google Cloud training=https://cloud.google.com/learn/training
kubernetes | Kubernetes | advanced | 25 | Kubernetes | docker | Pods and deployments;Services and ingress;Config and secrets;Scaling and probes | Deploy a 2-service app on a local cluster | Kubernetes basics=https://kubernetes.io/docs/tutorials/kubernetes-basics/
terraform | Infrastructure as code | advanced | 20 | Terraform | aws-basics | Providers and resources;State;Modules;Variables and outputs | Provision a VM and a bucket with Terraform | Terraform tutorials=https://developer.hashicorp.com/terraform/tutorials
monitoring | Monitoring and observability | advanced | 10 | Monitoring | | Metrics and logs;Prometheus basics;Dashboards;Alerting | Add metrics and a dashboard to a service | Prometheus overview=https://prometheus.io/docs/introduction/overview/
serverless | Serverless basics | advanced | 12 | Serverless | | Functions as a service;Event triggers;Limits and cold starts;Deploying edge functions | Build and deploy a small API as a serverless function | Cloudflare Workers docs=https://developers.cloudflare.com/workers/
numpy-pandas | NumPy and Pandas | core | 25 | Pandas;NumPy | python-basics | Arrays and vectorisation;DataFrames;Cleaning and merging;Grouping and pivoting | Clean and analyse a Kaggle dataset | Pandas getting started=https://pandas.pydata.org/docs/getting_started/index.html;NumPy learn=https://numpy.org/learn/
data-viz | Data visualisation | core | 20 | Data Visualization;Matplotlib | numpy-pandas | Matplotlib and seaborn;Choosing the right chart;Dashboards in Tableau or Power BI;Data storytelling | Build a dashboard from a public dataset | Matplotlib tutorials=https://matplotlib.org/stable/tutorials/index.html;Seaborn tutorial=https://seaborn.pydata.org/tutorial.html
excel | Excel for analysis | foundation | 15 | Excel | | Formulas and lookups;Pivot tables;Charts;Data cleaning | Analyse a sales sheet with a pivot table and a chart | Excel help=https://support.microsoft.com/en-us/excel
statistics | Statistics and probability | core | 30 | Statistics | | Descriptive statistics;Probability;Distributions;Hypothesis testing;Regression | Run a hypothesis test on a real dataset | Khan Academy statistics=https://www.khanacademy.org/math/statistics-probability
data-analysis | Data analysis and ETL | core | 20 | Data Analysis;ETL | numpy-pandas;sql-basics | Exploratory analysis;SQL for analysis;Building a simple pipeline;Reporting findings | Complete an end-to-end analysis project and write it up | 10 minutes to pandas=https://pandas.pydata.org/docs/user_guide/10min.html;Kaggle: Intro to Machine Learning=https://www.kaggle.com/learn/intro-to-machine-learning
ml-basics | Machine learning | core | 45 | Machine Learning | numpy-pandas;statistics | Supervised learning;Model evaluation;Feature engineering;Overfitting and regularisation;Unsupervised learning | Complete 2 Kaggle competitions or datasets | scikit-learn getting started=https://scikit-learn.org/stable/getting_started.html;Machine Learning Specialization=https://www.coursera.org/specializations/machine-learning-introduction
deep-learning | Deep learning | advanced | 45 | Deep Learning;TensorFlow;PyTorch;Keras | ml-basics | Neural network basics;CNNs;RNNs and transformers;Training and tuning;Deploying a model | Train an image classifier | PyTorch tutorials=https://docs.pytorch.org/tutorials/;TensorFlow tutorials=https://www.tensorflow.org/tutorials;DeepLearning.AI=https://www.deeplearning.ai/
nlp-cv | NLP and computer vision | advanced | 30 | NLP;Computer Vision | deep-learning | Text preprocessing;Embeddings;Image classification and detection;Using pretrained models | Build a sentiment classifier | Hugging Face course=https://huggingface.co/learn
big-data | Big data tools | advanced | 20 | Big Data | python-basics;sql-basics | Distributed processing;Spark basics;Working with large files;Data lakes vs warehouses | Process a 1 GB dataset with PySpark | Apache Spark docs=https://spark.apache.org/docs/latest/
kotlin-basics | Kotlin | foundation | 25 | Kotlin | | Syntax and null safety;Classes and data classes;Collections and lambdas;Coroutines | Solve 20 problems in Kotlin | Kotlin docs=https://kotlinlang.org/docs/getting-started.html
android | Android development | core | 50 | Android | kotlin-basics | Activities and Jetpack Compose;Navigation;Networking with Retrofit;Local storage with Room;Publishing | Build and publish a notes app | Android courses=https://developer.android.com/courses
flutter | Flutter | core | 45 | Flutter;Dart | | Dart basics;Widgets and layout;State management;Networking;Navigation | Build a cross-platform expense tracker | Flutter learn=https://docs.flutter.dev/learn/pathway
react-native | React Native | core | 35 | React Native | react | Core components;Navigation;State and storage;Native modules;Building an app | Build a mobile version of a web project | React Native docs=https://reactnative.dev/docs/getting-started
ios-swift | Swift and iOS | core | 50 | Swift;iOS | | Swift basics;SwiftUI;Data and networking;App lifecycle | Build a simple SwiftUI app | SwiftUI tutorials=https://developer.apple.com/tutorials/swiftui
firebase | Firebase and local storage | core | 12 | Firebase;SQLite | | Authentication;Firestore;Storage;SQLite basics | Add login and cloud sync to an app | Firebase docs=https://firebase.google.com/docs
communication | Communication and teamwork | foundation | 10 | Communication;Teamwork;Leadership | | Explaining technical ideas simply;Writing clear emails;Group discussion practice;Behavioural answers (STAR) | Record yourself answering 10 interview questions;Run a code walkthrough for a friend |
`;

export type Resource = { title: string; url: string };
export type Topic = {
  id: string;
  title: string;
  level: "foundation" | "core" | "advanced";
  hours: number;
  covers: string[];
  prerequisites: string[];
  outline: string[];
  practice: string[];
  resources: Resource[];
};

const list = (s: string) => s.split(";").map((x) => x.trim()).filter(Boolean);

function parse(raw: string): Topic[] {
  const out: Topic[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const [id, title, level, hours, covers = "", prereq = "", outline = "", practice = "", resources = ""] = t.split("|").map((s) => s.trim());
    out.push({
      id, title, level: level as Topic["level"], hours: Number(hours),
      covers: list(covers), prerequisites: list(prereq), outline: list(outline), practice: list(practice),
      resources: list(resources).map((r) => {
        const i = r.indexOf("=");
        return { title: r.slice(0, i).trim(), url: r.slice(i + 1).trim() };
      }),
    });
  }
  return out;
}

export const TOPICS: Topic[] = parse(RAW);
export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

/** Skill name -> the topic that teaches it (first topic wins). */
export const TOPIC_FOR_SKILL = new Map<string, Topic>();
for (const t of TOPICS) for (const s of t.covers) if (!TOPIC_FOR_SKILL.has(s)) TOPIC_FOR_SKILL.set(s, t);
