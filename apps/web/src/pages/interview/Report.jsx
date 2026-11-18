import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Info, Printer, RotateCcw, XCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { getInterviewReport } from '../../services/interviewService';

const tone = (s) => (s >= 75 ? '#059669' : s >= 50 ? '#d97706' : '#e11d48');
const VERDICT = { strong: 'Strong', partial: 'Partial', weak: 'Weak', skipped: 'Skipped' };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Ring({ value }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label={`Overall score ${value} out of 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={tone(value)} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" className="fill-current font-extrabold" fontSize="30">{value}</text>
    </svg>
  );
}

function Bar({ label, value, hint }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{label}</span><span className="font-mono font-bold">{value}%</span></div>
      <div className="h-2 rounded-full bg-[#EAE6DF] dark:bg-neutral-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${value}%`, background: tone(value) }} /></div>
      {hint && <p className="text-[11px] text-[#5E5B56] dark:text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getInterviewReport(id));
    } catch (err) {
      setError(err.response?.status === 404 ? 'This report is not available. The interview may still be in progress or may have been deleted.' : 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading your report..." />;
  if (error || !data?.report) return <ErrorState message={error || 'Report not found.'} onRetry={load} />;
  const { interview: iv, report: rp } = data;

  return (
    <div className="min-h-screen bg-canvas text-[#111111] dark:text-[#E4E4E7] py-8 px-4 font-body">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(0,0,0,0.08)] dark:border-neutral-800 pb-5">
          <div>
            <div className="text-xs text-[#5E5B56] dark:text-neutral-400 font-mono mb-1">
              <Link to="/dashboard" className="hover:underline">Dashboard</Link> / <Link to="/interview/history" className="hover:underline">Interviews</Link> / Report
            </div>
            <h1 className="text-3xl font-extrabold font-heading">Interview report</h1>
            <p className="text-sm text-[#5E5B56] dark:text-neutral-400 mt-1">
              {iv.targetRole}{iv.companyName ? ` • ${iv.companyName}` : ''} • {iv.interviewType.toLowerCase()} round • {iv.difficulty.toLowerCase()} • {new Date(iv.completedAt || iv.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-3 print:hidden">
            <Button variant="secondary" onClick={() => window.print()}><Printer size={14} /> Print</Button>
            <Button onClick={() => navigate('/interview/setup/role')}><RotateCcw size={14} /> Practise again</Button>
          </div>
        </div>

        <Card className="grid md:grid-cols-[auto,1fr] gap-8 items-center">
          <div className="text-center">
            <Ring value={rp.overallScore} />
            <div className="mt-2"><Badge variant="primary">{rp.readiness}</Badge></div>
          </div>
          <div className="space-y-4">
            <Bar label="Technical answers" value={rp.technicalScore} hint="How many key ideas your technical answers covered" />
            <Bar label="Behavioural answers" value={rp.behavioralScore} hint="Structure, ownership, specifics and relevance" />
            <Bar label="Communication" value={rp.communicationScore} hint="Length, examples and clarity of how you answered" />
            <p className="text-xs text-[#5E5B56] dark:text-neutral-400">
              {rp.completion.answered} answered, {rp.completion.skipped} skipped{rp.completion.planned > rp.questions.length ? `, ${rp.completion.planned - rp.questions.length} not reached` : ''}.
            </p>
          </div>
        </Card>

        <div role="note" className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-600" /><span>{rp.caveat}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="space-y-3">
            <h2 className="font-bold font-heading inline-flex items-center gap-2 text-emerald-600"><CheckCircle2 size={18} /> What went well</h2>
            <ul className="space-y-2 text-sm">{rp.strengths.map((s) => <li key={s} className="flex gap-2"><span className="text-emerald-600">✓</span><span>{s}</span></li>)}</ul>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-bold font-heading inline-flex items-center gap-2 text-[#C85232]"><AlertTriangle size={18} /> What to improve</h2>
            <ul className="space-y-2 text-sm">{rp.improvements.map((s) => <li key={s} className="flex gap-2"><span className="text-[#C85232]">!</span><span>{s}</span></li>)}</ul>
          </Card>
        </div>

        {rp.topics.length > 1 && (
          <Card className="space-y-3">
            <h2 className="font-bold font-heading">By topic</h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {rp.topics.map((t) => <Bar key={t.topic} label={`${t.topic}${t.kind === 'HR' ? ' (HR)' : ''}`} value={t.average} />)}
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="font-bold font-heading text-lg">Question by question</h2>
          {rp.questions.map((q, idx) => {
            const isOpen = open === idx;
            return (
              <div key={q.id} className="rounded-2xl border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 bg-surface overflow-hidden">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : idx)} className="w-full text-left p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#5E5B56] dark:text-neutral-400">Q{q.order} • {q.topic} • {q.difficulty.toLowerCase()}</p>
                    <p className="text-sm font-semibold">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: tone(q.score), background: `${tone(q.score)}1f` }}>{VERDICT[q.verdict]} {q.skipped ? '' : `• ${q.score}`}</span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-4 space-y-4 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#5E5B56] dark:text-neutral-400 mb-1">Your answer {q.skipped ? '' : `(${q.words} words, ${mmss(q.seconds)})`}</p>
                      <p className="rounded-lg bg-[#FAF8F5] dark:bg-[#0E0E10] border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-3 whitespace-pre-wrap">{q.answer || 'Skipped.'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#5E5B56] dark:text-neutral-400 mb-1">{q.kind === 'HR' ? 'What a strong answer includes' : 'Key ideas'}</p>
                      <ul className="grid sm:grid-cols-2 gap-1.5">
                        {q.concepts.map((c) => (
                          <li key={c.label} className="flex items-start gap-2 text-xs">
                            {c.hit ? <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" aria-label="covered" /> : <XCircle size={14} className="text-rose-500 mt-0.5 shrink-0" aria-label="missed" />}
                            <span>{c.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {q.notes.length > 0 && <ul className="list-disc pl-5 text-xs space-y-1">{q.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                    <div>
                      <p className="text-xs font-bold uppercase text-[#5E5B56] dark:text-neutral-400 mb-1">{q.kind === 'HR' ? 'How to approach it' : 'Model answer'}</p>
                      <p className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">{q.modelAnswer}</p>
                      <p className="text-xs text-[#5E5B56] dark:text-neutral-400 mt-2">Tip: {q.tip}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <Card className="space-y-4">
          <h2 className="font-bold font-heading inline-flex items-center gap-2"><BookOpen size={18} className="text-[#C85232]" /> What to do next</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {rp.recommendations.map((r) => (
              <div key={r.text} className="rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 p-4 flex flex-col justify-between gap-3">
                <p className="text-sm">{r.text}</p>
                <Link to={r.link} className="text-xs font-bold text-[#C85232] inline-flex items-center gap-1">{r.label} <ArrowRight size={12} /></Link>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
