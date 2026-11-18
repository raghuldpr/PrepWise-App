import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Lightbulb, Loader2, Play, RotateCcw, Send, XCircle } from 'lucide-react';
import { CODING_BY_ID, CODING_PROBLEMS } from '@prepwise/content';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { errorMessage, getCodingSolution, getCodingSubmissions, submitCoding } from '../../services/codingService';
import { preparePython, runSubmission } from '../../lib/codeRunner';

const LANGS = [['javascript', 'JavaScript'], ['python', 'Python']];
const SAMPLE_TESTS = 2;
const DIFF = { EASY: 'text-emerald-700 dark:text-emerald-400', MEDIUM: 'text-amber-700 dark:text-amber-400', HARD: 'text-rose-700 dark:text-rose-400' };
const VERDICT_STYLE = {
  Accepted: 'border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  default: 'border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
};

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable: the draft is just not kept */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const inputText = (problem, args) => problem.params.map((p, i) => `${p} = ${JSON.stringify(args[i])}`).join('\n');
const cut = (s, n = 300) => (s.length > n ? `${s.slice(0, n)}...` : s);

/** Renders `code` spans inside plain statement text. */
const Rich = ({ text }) => (
  <>{text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') ? <code key={i} className="px-1 rounded bg-[#EAE6DF] dark:bg-[#2A2A2A] text-[0.85em]">{part.slice(1, -1)}</code> : <React.Fragment key={i}>{part}</React.Fragment>))}</>
);

export default function CodingProblemDetail() {
  const { id } = useParams();
  const problem = CODING_BY_ID.get(id);
  const [language, setLanguage] = useState(() => store.get('pw_code_lang') || 'javascript');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('problem'); // problem | submissions | solution
  const [hintsShown, setHintsShown] = useState(0);
  const [running, setRunning] = useState(null); // null | 'run' | 'submit'
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [pyStatus, setPyStatus] = useState('idle');
  const [submissions, setSubmissions] = useState(null);
  const [solution, setSolution] = useState(null);
  const [solutionError, setSolutionError] = useState('');
  const editor = useRef(null);

  const draftKey = `pw_code_${id}_${language}`;
  useEffect(() => {
    if (!problem) return;
    setCode(store.get(draftKey) ?? problem.starter[language]);
    setResult(null);
    setNotice('');
  }, [draftKey, problem, language]);

  useEffect(() => { setTab('problem'); setHintsShown(0); setSubmissions(null); setSolution(null); setSolutionError(''); }, [id]);
  useEffect(() => { if (language === 'python') preparePython(setPyStatus).catch(() => {}); }, [language]);

  const onCode = (value) => { setCode(value); store.set(draftKey, value); };
  const onTab = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.target, { selectionStart: s, selectionEnd: en } = el;
    onCode(`${code.slice(0, s)}    ${code.slice(en)}`);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
  };
  const reset = () => { store.del(draftKey); setCode(problem.starter[language]); setResult(null); };

  const loadSubmissions = useCallback(async () => {
    try { setSubmissions(await getCodingSubmissions(id)); } catch { setSubmissions([]); }
  }, [id]);
  useEffect(() => { if (tab === 'submissions') loadSubmissions(); }, [tab, loadSubmissions]);
  useEffect(() => {
    if (tab !== 'solution' || solution || solutionError) return;
    getCodingSolution(id).then(setSolution).catch((err) => setSolutionError(errorMessage(err, 'Could not load the solution.')));
  }, [tab, id, solution, solutionError]);

  const execute = async (mode) => {
    if (running) return;
    setRunning(mode);
    setNotice('');
    setResult(null);
    setProgress(0);
    const subset = mode === 'run' ? { ...problem, tests: problem.tests.slice(0, SAMPLE_TESTS) } : problem;
    try {
      const res = await runSubmission({ language, code, problem: subset, onProgress: (done) => setProgress(done) });
      setResult({ ...res, mode, total: subset.tests.length });
      if (mode === 'submit') {
        const passed = res.results.filter((r) => r.status === 'passed').length;
        try {
          await submitCoding({ problemId: id, language, code, verdict: res.verdict, passed, total: subset.tests.length, timeMs: res.timeMs });
          setSubmissions(null);
          setSolution(null);
          setSolutionError('');
        } catch (err) {
          setNotice(errorMessage(err, 'Your result was not saved. Check your connection and submit again.'));
        }
      }
    } catch (err) {
      setResult({ verdict: 'Compile Error', compileError: err.message || 'The runner could not start.', results: [], logs: [], mode, total: subset.tests.length });
    } finally {
      setRunning(null);
    }
  };

  if (!problem) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <p className="text-sm">This problem does not exist. <Link to="/placement/coding" className="underline text-[#C85232]">Back to all problems</Link></p>
      </div>
    );
  }

  const idx = CODING_PROBLEMS.findIndex((p) => p.id === id);
  const next = CODING_PROBLEMS[idx + 1];
  const passedCount = result?.results.filter((r) => r.status === 'passed').length ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      <Link to="/placement/coding" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5E5B56] dark:text-[#A0A0A0] hover:text-[#C85232]"><ArrowLeft size={16} /> All problems</Link>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ------------------------------------------------ left: problem */}
        <Card className="space-y-4 min-w-0">
          <div>
            <div className="flex flex-wrap gap-2 mb-2"><Badge variant="primary">{problem.topic}</Badge><span className={`text-xs font-bold uppercase self-center ${DIFF[problem.difficulty]}`}>{problem.difficulty.toLowerCase()}</span></div>
            <h1 className="text-2xl font-extrabold font-heading">{problem.title}</h1>
          </div>
          <div className="flex gap-2 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)]" role="tablist">
            {[['problem', 'Problem'], ['submissions', 'My submissions'], ['solution', 'Solution']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
                className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${tab === k ? 'border-[#C85232] text-[#C85232]' : 'border-transparent text-[#5E5B56] dark:text-[#A0A0A0]'}`}>{l}</button>
            ))}
          </div>

          {tab === 'problem' && (
            <div className="space-y-5 text-sm">
              <p><Rich text={problem.statement} /></p>
              <div className="space-y-3">
                {problem.tests.slice(0, SAMPLE_TESTS).map((t, i) => (
                  <div key={i}>
                    <p className="text-xs font-bold uppercase text-[#5E5B56] dark:text-[#A0A0A0] mb-1">Example {i + 1}</p>
                    <pre className="rounded-lg bg-[#FAF8F5] dark:bg-[#0E0E10] border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words">{cut(inputText(problem, t.args))}{'\n'}returns {cut(JSON.stringify(t.expected))}</pre>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-[#5E5B56] dark:text-[#A0A0A0] mb-1">Constraints</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">{problem.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
              <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">Write the function <code>{problem.fn}</code>. It must <b>return</b> the answer (printing does not count).{problem.compare !== 'exact' ? ' The order of the answer does not matter.' : ''}</p>
              <div className="space-y-2">
                {problem.hints.slice(0, hintsShown).map((h, i) => <p key={i} className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs"><Lightbulb size={13} className="inline mr-1 text-amber-600" />Hint {i + 1}: {h}</p>)}
                {hintsShown < problem.hints.length && (
                  <button type="button" onClick={() => setHintsShown((n) => n + 1)} className="text-xs font-semibold text-[#C85232] inline-flex items-center gap-1"><Lightbulb size={13} /> Show hint {hintsShown + 1} of {problem.hints.length}</button>
                )}
              </div>
            </div>
          )}

          {tab === 'submissions' && (
            <div className="space-y-2 text-sm">
              {submissions === null ? <p className="text-[#5E5B56]">Loading...</p> : submissions.length === 0 ? <p className="text-[#5E5B56] dark:text-[#A0A0A0]">No submissions yet. Press Submit to record an attempt.</p> : submissions.map((s) => (
                <div key={s.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${s.verdict === 'Accepted' ? 'text-emerald-600' : 'text-rose-600'}`}>{s.verdict} • {s.passed}/{s.total} tests</span>
                    <span className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{s.language} • {new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                  <button type="button" className="text-xs font-semibold text-[#C85232] mt-1" onClick={() => { setLanguage(s.language); store.set(`pw_code_${id}_${s.language}`, s.code); setCode(s.code); setTab('problem'); }}>Load this code into the editor</button>
                </div>
              ))}
            </div>
          )}

          {tab === 'solution' && (
            <div className="space-y-3 text-sm">
              {solutionError ? <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs">{solutionError}</p> : !solution ? <p className="text-[#5E5B56]">Loading...</p> : (
                <>
                  <p>{solution.explanation}</p>
                  <p className="text-xs"><b>Complexity:</b> {solution.complexity}</p>
                  <pre className="rounded-lg bg-[#121214] text-emerald-300 p-3 text-xs overflow-x-auto">{solution[language]}</pre>
                  <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">Reference solution in {language === 'python' ? 'Python' : 'JavaScript'}. Switch the editor language to see the other one. Try to write your own version before copying.</p>
                </>
              )}
            </div>
          )}
        </Card>

        {/* ------------------------------------------------ right: editor and results */}
        <div className="space-y-4 min-w-0">
          <Card padding="compact" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" htmlFor="lang">Language</label>
                <select id="lang" value={language} disabled={!!running} onChange={(e) => { setLanguage(e.target.value); store.set('pw_code_lang', e.target.value); }}
                  className="rounded-lg px-2 py-1 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]">
                  {LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {language === 'python' && pyStatus === 'loading' && <span className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Loading Python (first time only)...</span>}
                {language === 'python' && pyStatus === 'failed' && <span role="alert" className="text-xs text-rose-600">Python could not load. Check your connection.</span>}
              </div>
              <button type="button" onClick={reset} className="text-xs font-semibold text-[#5E5B56] dark:text-[#A0A0A0] hover:text-[#C85232] inline-flex items-center gap-1"><RotateCcw size={13} /> Reset code</button>
            </div>
            <textarea ref={editor} value={code} onChange={(e) => onCode(e.target.value)} onKeyDown={onTab} spellCheck={false} rows={16} aria-label="Code editor"
              className="w-full bg-[#121214] text-emerald-300 font-mono text-xs p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C85232] resize-y leading-relaxed" />
            <p className="text-[11px] text-[#5E5B56] dark:text-[#A0A0A0]">Your draft is saved in this browser. Run checks the {SAMPLE_TESTS} examples. Submit runs all {problem.tests.length} tests and records the attempt.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => execute('run')} disabled={!!running || !code.trim()}>{running === 'run' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run examples</Button>
              <Button onClick={() => execute('submit')} disabled={!!running || !code.trim()}>{running === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit</Button>
            </div>
            {running && <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]" role="status">Running test {Math.min(progress + 1, problem.tests.length)}...</p>}
          </Card>

          {notice && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {notice}</p>}

          {result && (
            <Card padding="compact" className="space-y-3" aria-live="polite">
              <div className={`rounded-xl border px-4 py-3 ${VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.default}`}>
                <p className="font-bold inline-flex items-center gap-2">{result.verdict === 'Accepted' ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {result.verdict}{result.mode === 'run' ? ' (examples only)' : ''}</p>
                {!result.compileError && <p className="text-xs mt-0.5">{passedCount} of {result.total} tests passed in {result.timeMs} ms{result.mode === 'run' && result.verdict === 'Accepted' ? '. Now press Submit to run every test.' : ''}</p>}
                {result.compileError && <p className="text-xs mt-1 font-mono whitespace-pre-wrap break-words">{result.compileError}</p>}
              </div>
              {result.verdict === 'Accepted' && result.mode === 'submit' && (
                <p className="text-sm">Solved. {next ? <Link className="font-semibold text-[#C85232] inline-flex items-center gap-1" to={`/placement/coding/${next.id}`}>Next: {next.title} <ChevronRight size={14} /></Link> : 'You finished the last problem.'} You can also open the Solution tab to compare approaches.</p>
              )}
              <ul className="space-y-2">
                {result.results.map((r) => {
                  const t = problem.tests[r.index];
                  const ok = r.status === 'passed';
                  return (
                    <li key={r.index} className="rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-3 text-xs space-y-1">
                      <p className={`font-bold inline-flex items-center gap-1.5 ${ok ? 'text-emerald-600' : r.status === 'skipped' ? 'text-[#5E5B56]' : 'text-rose-600'}`}>
                        {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Test {r.index + 1}: {r.status === 'timeout' ? 'time limit exceeded' : r.status === 'error' ? 'error' : r.status}
                      </p>
                      {!ok && r.status !== 'skipped' && (
                        <>
                          <pre className="whitespace-pre-wrap break-words font-mono">{cut(inputText(problem, t.args))}</pre>
                          <p><b>Expected:</b> <span className="font-mono">{cut(JSON.stringify(t.expected))}</span></p>
                          {r.actual !== undefined && <p><b>Your output:</b> <span className="font-mono">{r.actual}</span></p>}
                          {r.message && <p className="text-rose-600 font-mono break-words">{r.message}</p>}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              {result.logs?.length > 0 && (
                <div><p className="text-xs font-bold uppercase text-[#5E5B56] dark:text-[#A0A0A0] mb-1">Console output</p><pre className="rounded-lg bg-[#121214] text-neutral-200 p-3 text-xs overflow-x-auto whitespace-pre-wrap">{result.logs.join('\n')}</pre></div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
