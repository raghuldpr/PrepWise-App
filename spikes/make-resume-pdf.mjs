// Generates a realistic single-column resume PDF (synthetic person) for manual browser testing.
// Usage: node spikes/make-resume-pdf.mjs <out.pdf>
import PDFDocument from "pdfkit";
import fs from "node:fs";

const out = process.argv[2];
const doc = new PDFDocument({ size: "A4", margin: 44 });
doc.pipe(fs.createWriteStream(out));
const H = (t) => { doc.moveDown(0.6).font("Helvetica-Bold").fontSize(12).text(t.toUpperCase()).moveDown(0.2); };
const P = (t) => doc.font("Helvetica").fontSize(10).text(t);
const B = (t) => doc.font("Helvetica").fontSize(10).text("• " + t, { indent: 8 });

doc.font("Helvetica-Bold").fontSize(20).text("Asha Rao");
P("asha.rao@example.com | +91 98765 43210 | github.com/asharao | linkedin.com/in/asharao");
H("Education");
P("B.Tech Computer Science, ABC Institute of Technology    2021 - 2025");
P("CGPA: 8.4 / 10");
H("Skills");
P("Languages: Java, Python, SQL, JavaScript");
P("Backend: Spring Boot, Hibernate, REST APIs, JWT | Databases: MySQL, MongoDB, Redis");
P("Tools: Docker, Git, GitHub Actions, Linux, JUnit, AWS EC2");
H("Experience");
P("Software Intern, Acme Corp    Jun 2024 - Aug 2024");
B("Built 6 REST endpoints in Spring Boot that cut report generation time by 35%");
B("Wrote 40 JUnit tests, raising coverage from 52% to 81%");
B("Containerized the service with Docker and automated deployment using GitHub Actions");
H("Projects");
P("PrepWise - Placement Preparation Platform");
B("Designed a REST API with JWT authentication for 500+ students using Spring Boot and MySQL");
B("Implemented Redis caching, reducing average response time from 420 ms to 90 ms");
B("Deployed on AWS EC2 with Docker and Nginx");
P("Library Management System");
B("Developed a Java application with MySQL database design (normalization up to 3NF)");
B("Optimized SQL queries with indexing, improving search speed by 60%");
H("Achievements");
B("Solved 300+ problems on LeetCode (data structures and algorithms)");
doc.end();
