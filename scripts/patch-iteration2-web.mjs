// One-off codemod used in Iteration 2: removes hard-coded demo data / client-side grading from the
// practice and progress pages so they only show what the server returns.
import fs from "node:fs";
const dir = new URL("../apps/web/src/pages/placement/", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dir), "utf8").split(String.fromCharCode(13,10)).join(String.fromCharCode(10));
const write = (f, s) => fs.writeFileSync(new URL(f, dir), s);

function must(s, pattern, replacement, label) {
  const out = s.replace(pattern, replacement);
  if (out === s) throw new Error("patch did not apply: " + label);
  return out;
}

for (const [file, constName] of [["Aptitude.jsx", "FALLBACK_APTITUDE_QUESTIONS"], ["Technical.jsx", "FALLBACK_TECHNICAL_QUESTIONS"]]) {
  let s = read(file);
  // 1. drop the hard-coded question array
  s = must(s, new RegExp(`(?:// [^\\n]*\\n)?const ${constName} = \\[[\\s\\S]*?\\n\\];\\n`), "", `${file} const`);
  // 2. empty result -> empty list; failure -> real error state
  s = must(s, /      \} else \{\n(?:        \/\/ Filter fallbacks if needed\n)?        let filtered = FALLBACK_\w+;[\s\S]*?\n      \}\n    \} catch \(err\) \{\n      console\.warn\([^\n]*\n      setQuestions\(FALLBACK_\w+\);\n/,
    "      } else {\n        setQuestions([]);\n      }\n    } catch (err) {\n      console.error('Failed to load questions:', err);\n      setError('Could not load questions. Please check your connection and try again.');\n", `${file} fetch`);
  // 3. no client-side grading when the server is unreachable
  s = must(s, /    \} catch \(err\) \{\n      console\.warn\('API submission failed[\s\S]*?\n    \} finally \{\n      setSubmitting\(false\);/,
    "    } catch (err) {\n      console.error('Answer submission failed:', err);\n      setError('Your answer could not be submitted. Please try again.');\n    } finally {\n      setSubmitting(false);", `${file} submit`);
  write(file, s);
  console.log("patched", file);
}

// Progress: build the view from /users/analytics (the old page expected a shape the API never returned
// and silently showed invented numbers instead).
let p = read("Progress.jsx");
p = must(p, /const FALLBACK_PROGRESS_DATA = \{[\s\S]*?\n\};\n\n/, `const CATEGORY_COLORS = {
  APTITUDE: 'bg-emerald-500',
  TECHNICAL: 'bg-rose-500',
  DSA: 'bg-indigo-500',
  CODING: 'bg-amber-500',
  HR: 'bg-[#C85232]',
};

// Map the /users/analytics response onto the shape this page renders.
function toProgressView(a) {
  return {
    overallAccuracy: Math.round(a.overallAccuracy || 0),
    totalAttempted: a.totalQuestionsAttempted || 0,
    totalCorrect: a.totalQuestionsSolved || 0,
    totalTimeSeconds: (a.totalPracticeMinutes || 0) * 60,
    currentStreakDays: a.currentStreakDays || 0,
    categoryBreakdown: (a.categoryBreakdowns || []).map((c) => ({
      id: c.categoryId,
      categoryName: c.categoryName,
      attempted: c.questionsAttempted,
      correct: c.questionsCorrect,
      accuracy: Math.round(c.accuracy || 0),
      moduleType: c.moduleType,
      color: CATEGORY_COLORS[c.moduleType] || 'bg-slate-500',
    })),
    weakAreas: (a.weakAreas || []).map((w) => ({
      categoryId: w.categoryName,
      categoryName: w.categoryName,
      accuracy: Math.round(w.accuracy || 0),
      attempted: w.attempted,
      moduleType: w.moduleType,
      recommendation: w.recommendation,
      practiceLink: w.practiceLink,
    })),
  };
}

`, "Progress const");
p = must(p, /    try \{\n      const \[progRes, weakRes\] = await Promise\.allSettled\(\[[\s\S]*?\n    \} finally \{\n      setLoading\(false\);/,
`    try {
      const view = toProgressView(await getUserAnalytics());
      setProgressData(view);
      setWeakAreas(view.weakAreas);
    } catch (err) {
      console.error('Failed to load progress analytics:', err);
      setError('Could not load your progress analytics. Please try again.');
    } finally {
      setLoading(false);`, "Progress fetch");
write("Progress.jsx", p);
console.log("patched Progress.jsx");
