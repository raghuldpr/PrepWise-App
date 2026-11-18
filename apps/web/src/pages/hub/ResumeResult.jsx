import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, Lightbulb, RefreshCw, Target, Trash2 } from 'lucide-react';
import { ROLES } from '@prepwise/content';
import { analyzeResume } from '@prepwise/core';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { deleteResume, getAnalysis, getResumeText, saveAnalysis } from '../../services/resumeService';

const PRIORITY = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
const SECTION_LABEL = {
  summary: 'Summary', education: 'Education', experience: 'Experience', projects: 'Projects',
  skills: 'Skills', certifications: 'Certifications', achievements: 'Achievements',
};
const ringColor = (s) => (s >= 80 ? '#059669' : s >= 65 ? '#d97706' : '#e11d48');

function ScoreRing({ score }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={ringColor(score)} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 70 70)"
      />
      <text x="70" y="68" textAnchor="middle" className="fill-current font-extrabold" fontSize="36">{score}</text>
      <text x="70" y="90" textAnchor="middle" className="fill-current" fontSize="12" opacity="0.6">out of 100</text>
    </svg>
  );
}

export default function ResumeResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleId, setRoleId] = useState('');
  const [reBusy, setReBusy] = useState(false);
  const [reError, setReError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const a = await getAnalysis(id);
      setData(a);
      setRoleId(a.targetRoleId && ROLES.some((r) => r.id === a.targetRoleId) ? a.targetRoleId : ROLES[0].id);
    } catch (err) {
      console.error('Failed to load analysis:', err);
      setError(err.response?.status === 404 ? 'This analysis was not found.' : 'Could not load this analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const s of data?.result.skills.found ?? []) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [data]);

  const reanalyze = async () => {
    setReBusy(true);
    setReError('');
    try {
      const { text } = await getResumeText(data.resume.id);
      const role = ROLES.find((r) => r.id === roleId) || ROLES[0];
      const result = analyzeResume({ text, roleId: role.id, roleLabel: role.title });
      const saved = await saveAnalysis({
        resumeId: data.resume.id, filename: data.resume.originalFilename, fileType: data.resume.fileType,
        fileSize: data.resume.fileSize, text, targetRoleId: role.id, targetRole: role.title, result,
      });
      navigate(`/hub/resume/result/${saved.analysisId}`);
    } catch (err) {
      console.error('Re-analysis failed:', err);
      setReError(err.response?.data?.message || 'Could not re-analyse this resume. Please try again.');
    } finally {
      setReBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this resume and all its analyses? This cannot be undone.')) return;
    try {
      await deleteResume(data.resume.id);
      navigate('/hub/resume');
    } catch {
      setReError('Could not delete the resume. Please try again.');
    }
  };

  if (loading) return <div className="max-w-5xl mx-auto py-12 px-4"><LoadingState message="Loading your analysis..." /></div>;
  if (error || !data) return <div className="max-w-5xl mx-auto py-12 px-4"><ErrorState message={error || 'Analysis not found.'} onRetry={load} /></div>;

  const r = data.result;
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <button onClick={() => navigate('/hub/resume')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5E5B56] dark:text-[#A0A0A0] hover:text-[#C85232]">
        <ArrowLeft size={16} /> All resumes
      </button>

      <Card className="flex flex-col md:flex-row items-center gap-6">
        <ScoreRing score={r.score} />
        <div className="flex-1 text-center md:text-left">
          <Badge variant="primary" icon={FileText}>{data.resume.originalFilename}</Badge>
          <h1 className="text-2xl font-extrabold font-heading mt-2">{r.grade}: {r.score}/100</h1>
          <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 inline-flex items-center gap-1.5">
            <Target size={14} /> Checked against {r.target.kind === 'jd' ? 'a job description' : `the ${r.target.label} role`} • {new Date(data.createdAt).toLocaleDateString()} • {r.stats.words} words
          </p>
          <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-2">Rule-based score (analyzer v{r.version}). It estimates how well the resume shows the target role's skills and how well it is written; it does not predict hiring decisions.</p>
        </div>
      </Card>

      <section>
        <h2 className="text-lg font-bold font-heading mb-3">Score breakdown</h2>
        <Card className="space-y-4">
          {r.breakdown.map((b) => (
            <div key={b.id}>
              <div className="flex justify-between text-sm font-semibold"><span>{b.label}</span><span>{b.score} / {b.max}</span></div>
              <div className="h-2 rounded-full bg-[rgba(0,0,0,0.08)] dark:bg-[rgba(255,255,255,0.1)] mt-1" role="progressbar" aria-valuenow={b.score} aria-valuemin={0} aria-valuemax={b.max}>
                <div className="h-2 rounded-full" style={{ width: `${(b.score / b.max) * 100}%`, background: ringColor((b.score / b.max) * 100) }} />
              </div>
              <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-1">{b.detail}</p>
            </div>
          ))}
        </Card>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold font-heading mb-3 inline-flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> Strengths</h2>
          {r.strengths.length ? <ul className="space-y-2 text-sm list-disc pl-5">{r.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            : <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">Nothing stands out yet. The suggestions below show where to start.</p>}
        </Card>
        <Card>
          <h2 className="font-bold font-heading mb-3 inline-flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600" /> Things to fix</h2>
          {r.weaknesses.length ? <ul className="space-y-2 text-sm list-disc pl-5">{r.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
            : <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">No major problems found.</p>}
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-bold font-heading mb-3 inline-flex items-center gap-2"><Lightbulb size={18} className="text-[#C85232]" /> Suggestions</h2>
        <div className="space-y-2">
          {r.suggestions.length === 0 && <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">No suggestions. Nice work.</p>}
          {r.suggestions.map((s, i) => (
            <Card key={i} padding="compact" className="flex items-start gap-3">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${PRIORITY[s.priority]}`}>{s.priority}</span>
              <p className="text-sm">{s.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold font-heading mb-1">Skills found ({r.skills.found.length})</h2>
          <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mb-3">Solid chips are shown in a project or experience. Dashed chips are only listed.</p>
          {byCategory.length === 0 && <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">No known skills were recognised.</p>}
          {byCategory.map(([cat, list]) => (
            <div key={cat} className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5E5B56] dark:text-[#A0A0A0] mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((s) => (
                  <span key={s.name} className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${s.demonstrated ? 'border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-dashed border-[#5E5B56]/50'}`}>{s.name}</span>
                ))}
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="font-bold font-heading mb-1">Missing for this target</h2>
          <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mb-3">Add these only if you genuinely have them, otherwise learn them through a small project.</p>
          {r.skills.missing.length === 0 ? <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">Everything we looked for is present.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {r.skills.missing.map((m) => (
                <span key={m.label} className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${m.weight === 3 ? 'border-rose-500/50 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300' : 'border-[#5E5B56]/40'}`}>
                  {m.label}{m.weight === 3 ? ' (core)' : ''}
                </span>
              ))}
            </div>
          )}
          {r.skills.jdKeywords && r.skills.jdKeywords.missing.length > 0 && (
            <p className="text-xs mt-4 text-[#5E5B56] dark:text-[#A0A0A0]">Job-description words not in your resume: {r.skills.jdKeywords.missing.join(', ')}</p>
          )}
        </Card>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-bold font-heading mb-3">Sections and contact</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {r.sections.map((s) => (
              <span key={s.id} className={`rounded-full px-2.5 py-0.5 border ${s.present ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/40 text-rose-700 dark:text-rose-300 line-through'}`}>{SECTION_LABEL[s.id] || s.id}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs mt-3">
            {Object.entries({ email: 'Email', phone: 'Phone', github: 'GitHub', linkedin: 'LinkedIn' }).map(([k, label]) => (
              <span key={k} className={`rounded-full px-2.5 py-0.5 border ${r.contact[k] ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/40 text-rose-700 dark:text-rose-300 line-through'}`}>{label}</span>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold font-heading mb-3">Check another role</h2>
          <div className="flex flex-wrap gap-3">
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={reBusy} className="flex-1 min-w-[12rem] rounded-xl px-3 py-2 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]">
              {ROLES.map((ro) => <option key={ro.id} value={ro.id}>{ro.title}</option>)}
            </select>
            <Button onClick={reanalyze} disabled={reBusy}>
              {reBusy ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Checking...</span> : <span className="inline-flex items-center gap-2"><RefreshCw size={16} /> Re-check</span>}
            </Button>
          </div>
          {reError && <p role="alert" className="text-sm text-rose-600 mt-2">{reError}</p>}
          <button type="button" onClick={remove} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <Trash2 size={14} /> Delete this resume
          </button>
        </Card>
      </section>
    </div>
  );
}
