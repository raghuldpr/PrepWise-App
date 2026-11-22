import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Brain, CheckCircle2, Compass, Info, Target, XCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import { errorMessage, getSmartCurve, getSmartNext, submitSmartAnswer } from '../../services/smartService';

const MODULES = [['', 'All topics'], ['APTITUDE', 'Aptitude'], ['DSA', 'DSA'], ['TECHNICAL', 'Technical'], ['HR', 'HR']];

function Curve({ curve }) {
  const W = 560, H = 190, L = 34, R = 10, T = 12, B = 26;
  const pts = curve.points;
  if (pts.length < 2) return <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">Answer a few questions and your learning curve will appear here.</p>;
  const x = (i) => L + (i / (pts.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rolling).toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Learning curve: rolling accuracy over your last ${pts.length} answers`}>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity="0.1" />
            <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.6">{g}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="#C85232" strokeWidth="2" />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={H - B + 8} r="2.2" fill={p.correct ? '#059669' : '#e11d48'} />)}
        <text x={L} y={H - 2} fontSize="9" fill="currentColor" fillOpacity="0.6">oldest</text>
        <text x={W - R} y={H - 2} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.6">latest ({pts.length} answers)</text>
      </svg>
      <figcaption className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
        Line: accuracy over your last 10 answers. Dots underneath: green right, red wrong.
        {curve.first10 !== null && <> Your first 10 answers were <b>{curve.first10}%</b> right and your latest 10 are <b>{curve.last10}%</b>.</>}
      </figcaption>
    </figure>
  );
}

export default function SmartPractice() {
  const [moduleType, setModuleType] = useState('');
  const [item, setItem] = useState(null); // { question, choice }
  const [curve, setCurve] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(Date.now());

  const loadNext = useCallback(async (mod) => {
    setLoading(true); setError(''); setResult(null); setSelected(null);
    try {
      const [next, c] = await Promise.all([getSmartNext(mod), getSmartCurve()]);
      setItem(next); setCurve(c);
      started.current = Date.now();
    } catch (err) {
      setItem(null);
      setError(errorMessage(err, 'Could not load a question.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNext(moduleType); }, [moduleType, loadNext]);

  const submit = async () => {
    if (selected === null || submitting) return;
    setSubmitting(true); setError('');
    try {
      const res = await submitSmartAnswer(item.question.id, selected, Math.round((Date.now() - started.current) / 1000));
      setResult(res);
      getSmartCurve().then(setCurve).catch(() => {});
    } catch (err) {
      setError(errorMessage(err, 'Could not save your answer. Try again.'));
    } finally { setSubmitting(false); }
  };

  const q = item?.question;
  const choice = item?.choice;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={Brain}>SMART PRACTICE</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">Practice what you need most</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-3xl">
          A reinforcement-learning method (a multi-armed bandit with Thompson sampling) chooses the next topic from your latest answers: a wrong answer makes a topic more likely to come back, and uncertain topics still get tried. No AI service is involved.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
        {MODULES.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={moduleType === k} onClick={() => setModuleType(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${moduleType === k ? 'bg-[#C85232] border-[#C85232] text-white' : 'border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]'}`}>{l}</button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
      {loading && !item && <LoadingState message="Choosing your next question..." />}

      {item && (
        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6 items-start">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="primary">{q.categoryName}</Badge>
              <span className="font-bold uppercase text-[#5E5B56] dark:text-[#A0A0A0]">{q.difficulty.toLowerCase()}</span>
              {choice.repeat && <span className="text-amber-700 dark:text-amber-400">You have seen every question here, so this is a revision.</span>}
            </div>
            <h2 className="text-lg font-bold font-heading">{q.title}</h2>
            <p className="text-sm whitespace-pre-wrap">{q.questionText}</p>
            <ul className="space-y-2" role="radiogroup" aria-label="Answer options">
              {q.options.map((o) => {
                const done = !!result;
                const isChosen = selected === o.id;
                const isRight = done && o.optionText === result.correctAnswer;
                const isWrongPick = done && isChosen && !result.isCorrect;
                return (
                  <li key={o.id}>
                    <button type="button" role="radio" aria-checked={isChosen} disabled={done || submitting} onClick={() => setSelected(o.id)}
                      className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition-colors ${isRight ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : isWrongPick ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : isChosen ? 'border-[#C85232] bg-[#C85232]/5' : 'border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.12)] hover:border-[#C85232]/50'}`}>
                      {o.optionText}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!result ? (
              <Button onClick={submit} disabled={selected === null || submitting} loading={submitting}>Submit answer</Button>
            ) : (
              <div className="space-y-3" aria-live="polite">
                <p className={`font-bold inline-flex items-center gap-2 ${result.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {result.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {result.isCorrect ? 'Correct' : `Not quite. The answer is: ${result.correctAnswer}`}
                </p>
                {result.explanation && <p className="text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#0E0E10] border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-3">{result.explanation}</p>}
                <Button onClick={() => loadNext(moduleType)}>Next question <ArrowRight size={14} /></Button>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="space-y-3">
              <h2 className="font-bold font-heading inline-flex items-center gap-2"><Target size={18} className="text-[#C85232]" /> Why this topic?</h2>
              <p className="text-sm">{choice.reason}</p>
              <p className="text-xs"><Badge size="sm">{choice.mode === 'exploit' ? 'Practising a weak area' : 'Exploring'}</Badge> <span className="text-[#5E5B56] dark:text-[#A0A0A0]">Target difficulty: {choice.targetDifficulty.toLowerCase()}</span></p>
              <ul className="space-y-2">
                {choice.arms.map((a) => (
                  <li key={a.categoryId}>
                    <div className="flex justify-between text-xs mb-0.5"><span className={a.chosen ? 'font-bold' : ''}>{a.name}{a.chosen ? ' (chosen)' : ''}</span><span className="font-mono">{a.wrongRate}% wrong · {a.attempted} recent</span></div>
                    <div className="h-2 rounded-full bg-[#EAE6DF] dark:bg-neutral-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${a.wrongRate}%`, background: a.chosen ? '#C85232' : '#8b8680' }} /></div>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[#5E5B56] dark:text-[#A0A0A0] flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> Each bar is the estimated chance you get that topic wrong, from your latest {choice.windowSize} answers (at most 200). The choice also uses a random draw, so it is not always the highest bar.</p>
            </Card>

            <Card className="space-y-3">
              <h2 className="font-bold font-heading inline-flex items-center gap-2"><Compass size={18} className="text-[#C85232]" /> Your learning curve</h2>
              {curve && <Curve curve={curve} />}
            </Card>
          </div>
        </div>
      )}

      <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
        Want a fixed set instead? Use <Link to="/placement/aptitude" className="underline text-[#C85232]">Aptitude</Link>, <Link to="/placement/technical" className="underline text-[#C85232]">Technical</Link> or <Link to="/placement/dsa" className="underline text-[#C85232]">DSA</Link> practice. Answers here count in your normal progress.
      </p>
    </div>
  );
}
