// Spike B: generate 3 sample resumes (different layouts), extract with pdfjs-dist,
// rebuild lines from text positions and detect section headings.
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const out = path.resolve("spikes/samples");
fs.mkdirSync(out, { recursive: true });

function make(name, draw) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const file = path.join(out, name);
    doc.pipe(fs.createWriteStream(file)).on("finish", () => resolve(file));
    draw(doc);
    doc.end();
  });
}

const H = (d, t) => d.font("Helvetica-Bold").fontSize(14).text(t.toUpperCase()).moveDown(0.3);
const P = (d, t) => d.font("Helvetica").fontSize(10.5).text(t).moveDown(0.3);

const files = [];
files.push(await make("single-column.pdf", (d) => {
  d.font("Helvetica-Bold").fontSize(22).text("Asha Rao").fontSize(10).font("Helvetica")
    .text("asha.rao@example.com | +91 98765 43210 | github.com/asharao | linkedin.com/in/asharao").moveDown();
  H(d, "Education"); P(d, "B.Tech Computer Science, ABC Institute of Technology, 2021 - 2025, CGPA 8.4");
  H(d, "Skills"); P(d, "Java, Spring Boot, React, MySQL, Docker, Git, Data Structures, REST APIs");
  H(d, "Experience"); P(d, "Software Intern, Acme Corp (Jun 2024 - Aug 2024)");
  P(d, "- Built 6 REST endpoints in Spring Boot, cutting report time by 35%");
  P(d, "- Wrote 40 unit tests, raising coverage from 52% to 81%");
  H(d, "Projects"); P(d, "PrepWise: placement prep platform using React and Spring Boot");
}));
files.push(await make("two-column.pdf", (d) => {
  d.font("Helvetica-Bold").fontSize(22).text("Ravi Kumar", 40, 40);
  d.font("Helvetica-Bold").fontSize(12).text("SKILLS", 40, 100);
  d.font("Helvetica").fontSize(10).text("Python\nSQL\nPandas\nDocker\nAWS", 40, 120);
  d.font("Helvetica-Bold").fontSize(12).text("EXPERIENCE", 220, 100);
  d.font("Helvetica").fontSize(10).text("Data Analyst Intern, Beta Ltd (2024)\n- Automated weekly dashboards, saving 6 hours/week\n- Cleaned 2M-row datasets using Pandas", 220, 120, { width: 330 });
  d.font("Helvetica-Bold").fontSize(12).text("EDUCATION", 220, 220);
  d.font("Helvetica").fontSize(10).text("B.Sc Statistics, XYZ University, 2022 - 2025", 220, 240);
}));
files.push(await make("no-headings-caps.pdf", (d) => {
  d.font("Helvetica").fontSize(10).text("Meera Nair  meera@example.com");
  d.moveDown().text("Objective: Seeking a backend role.");
  d.moveDown().text("PROJECTS"); d.text("Chat app with Node.js and MongoDB");
  d.moveDown().text("TECHNICAL SKILLS"); d.text("JavaScript, Node.js, MongoDB, Express");
}));

const HEADINGS = ["education", "skills", "technical skills", "experience", "projects", "work experience", "summary", "objective"];

for (const f of files) {
  const t0 = performance.now();
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(f)), useSystemFonts: true }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // group items by rounded y (line), then sort by x
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      (rows.get(key) ?? rows.set(key, []).get(key)).push({ x: it.transform[4], s: it.str, size: it.height, bold: /bold/i.test(tc.styles[it.fontName]?.fontFamily ?? "") });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const items = rows.get(y).sort((a, b) => a.x - b.x);
      lines.push({ text: items.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim(), x0: items[0].x, size: Math.max(...items.map((i) => i.size)) });
    }
  }
  const ms = (performance.now() - t0).toFixed(0);
  const found = lines.filter((l) => HEADINGS.includes(l.text.toLowerCase().replace(/:$/, "")));
  console.log(`\n== ${path.basename(f)}  (${ms} ms, ${lines.length} lines)`);
  console.log("headings found:", found.map((l) => l.text).join(", ") || "NONE");
  console.log("email:", (lines.map((l) => l.text).join("\n").match(/[\w.+-]+@[\w-]+\.[\w.]+/) ?? [])[0] ?? "NONE");
  console.log(lines.slice(0, 40).map((l) => `  [x=${Math.round(l.x0)}] ${l.text}`).join("\n"));
}
