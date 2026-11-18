# Iteration 3: resume analyzer (no AI)

Live: https://prepwise-api.prepwise-api.workers.dev/hub/resume

## How it works

```
Browser                                              Worker + D1
file (PDF/DOCX/TXT)
  -> pdfjs-dist / mammoth: text items
  -> layout.ts: reading order incl. two columns
  -> sections.ts: headings -> sections
  -> skills.ts: taxonomy matching
  -> signals.ts: contact, dates, bullets, metrics
  -> analyze.ts: score + advice            ---- POST /api/resume/analyses ---->  validate + store
                                            <--- GET  /api/resume/analyses/:id --
```

Everything heavy runs in the browser, because Workers Free allows 10 ms of CPU per request. **The original file never leaves the device.** The server stores the extracted text (so a resume can be re-checked for another role) and the result, and the user can delete both.

## Pieces (all in `packages/`)

| Piece | What it does |
|---|---|
| `content/skills-taxonomy.ts` | 110 hand-written skills with aliases. Ambiguous words (Go, C, R, node, express ...) only count inside skills-style lists. |
| `content/roles.ts` | 9 role profiles with weighted core/important/nice skills and "any of" groups (for example "a backend framework"). Reused by the skill-gap module in Iteration 4. |
| `core/resume/layout.ts` | Rebuilds reading order from positioned PDF text. Fixes the Iteration 0 failure where two-column resumes merged. A tab-aligned date column is not mistaken for a second column. |
| `core/resume/sections.ts` | Heading detection (education, skills, projects, ...). |
| `core/resume/skills.ts` | Matching with boundaries that keep C++, C#, Java, JavaScript, Node.js and .NET apart. Separates skills that are *listed* from skills *shown in a project*. |
| `core/resume/signals.ts` | Email/phone/links, date ranges and their errors, action verbs, weak phrases, metrics (dates are not counted as numbers). |
| `core/resume/jd.ts` | Job-description skills and repeated keywords with a tiny stemmer. |
| `core/resume/analyze.ts` | Weighted score and the advice engine. |
| `shared/resume.ts` | Zod schema the API uses to validate a stored analysis (score must equal the sum of the breakdown, known skills only, bounded sizes). |

## Score (100 points)

| Part | Max | Based on |
|---|---|---|
| Fit for the role (or match with the pasted job description) | 35 | Weighted coverage of the role's skills; a skill only listed counts 70%, one shown in a project 100%. For a job description: 75% skills, 25% repeated keywords. |
| Skills breadth | 15 | Distinct technical skills (12 = full marks) plus a Skills section |
| Completeness | 15 | Email, phone, GitHub/LinkedIn, education, skills, projects or experience |
| Impact and writing | 20 | Share of description lines with numbers, action verbs, amount of detail, minus weak phrases |
| Format and length | 10 | 250-750 words, valid dates, a name in the header |
| Role alignment | 5 | The target role is mentioned |

This is an original rubric for student resumes. It was informed by how Resume-Matcher (Apache-2.0) weights keyword and skill coverage and by OpenResume's PDF-parsing approach (AGPL-3.0), but **no code was copied from either**, so no licence obligations apply. The weights are a judgement call and should be tuned with real resumes.

Advice is rule-based and specific: it quotes the offending wording, names the missing core skills, and sorts items high, medium, low.

## API

`POST /api/resume/analyses`, `GET /api/resume`, `GET /api/resume/:id`, `GET /api/resume/analyses/:id`, `GET /api/resume/:id/text`, `DELETE /api/resume/:id`. Limits: 60,000 characters of text, 20 resumes and 60 analyses per user. Ownership is checked on every route. The analysis is computed by the client, so a user could submit an inflated score for their own account; that only affects their own data, so the server checks that the result is well-formed and internally consistent, not that it is honest.

## Verified

- 47 unit tests (24 for the resume engine): skills matching edge cases, phone/date/metric detection, scoring order (strong resume above 75, weak below 35), job-description matching, deterministic output, and three real PDFs including the two-column case.
- `scripts/smoke-resume.mjs`: 23 checks (validation, ownership isolation between two users, cascade delete) pass locally and on the live site; the auth and practice smoke suites still pass.
- Browser: uploaded a real generated PDF and a DOCX through the page. Scores 84 (Software Engineer) and 92 after "Re-check" as Backend Developer; the DOCX with a pasted job description reported Docker, AWS, TypeScript and Agile as missing. A too-short file and a `.exe` show friendly errors. The profile's target role pre-selects the matching role.
- Production: the PDF worker is served as `text/javascript`. I did not run the browser upload against the live site.
- Test accounts and their resumes were removed from the production database.

## Known limits

- Scanned/image PDFs cannot be read (no OCR); the user is told to export a text PDF or upload a DOCX.
- Parsing is heuristic. Unusual layouts (tables, text boxes, icons as bullets, three columns) may be misread. Test with real student resumes.
- Experience and project *quality* beyond numbers and verbs is not judged, and the score is an estimate, not a prediction.
- Re-checking a resume against a pasted job description is not offered (only roles); paste the posting again via a new upload.
- The skills taxonomy is small and hand-written; add skills and aliases in `skills-taxonomy.ts` (a test blocks duplicate aliases).
- Dashboard copy was updated; the sidebar and other pages may still use "AI" wording for features rebuilt in later iterations.
