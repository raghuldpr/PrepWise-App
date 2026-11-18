import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed, Target, TrendingUp } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import RolePicker, { useProfileRole } from '../../components/hub/RolePicker';
import { analyzeSkillGap, errorMessage, getLatestGapAnalysis } from '../../services/learningService';

const STATUS = {
  strong: { label: 'Covered', cls: 'border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
  improve: { label: 'Improve', cls: 'border-amber-600/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', icon: TrendingUp },
  missing: { label: 'Missing', cls: 'border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300', icon: CircleDashed },
};
const WEIGHT = { 3: 'Core', 2: 'Important', 1: 'Useful' };
const ringColor = (s) => (s >= 70 ? '#059669' : s >= 40 ? '#d97706' : '#e11d48');

function Ring({ value }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Readiness ${value} percent`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={ringColor(value)} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="64" textAnchor="middle" className="fill-current font-extrabold" fontSize="28">{value}%</text>
    </svg>
  );
}

export default function SkillGap() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profileRoleId, loaded } = useProfileRole();
  const [pick, setPick] = useState({ roleId: params.get('role') || 'software-engineer', stackId: params.get('stack') || '' });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      setAnalysis(await analyzeSkillGap({ roleId: p.roleId, stackId: p.stackId || null }));
    } catch (err) {
      setError(errorMessage(err, 'Could not analyse your skills. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // First visit: use the profile's target role (or the role in the URL) and analyse straight away.
  useEffect(() => {
    if (!loaded) return;
    const initial = { roleId: params.get('role') || profileRoleId || 'software-engineer', stackId: params.get('stack') || '' };
    setPick(initial);
    run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const next = (path) => navigate(`${path}?role=${analysis.roleId}${pick.stackId ? `&stack=${pick.stackId}` : ''}`);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={Target}>SKILL GAP</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">Where you stand for your target role</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Your skills are compared with what the role typically needs. Skills come from your profile and your latest resume check. Nothing is guessed by an AI.
        </p>
      </div>

      <Card className="space-y-4">
        <RolePicker roleId={pick.roleId} stackId={pick.stackId} onChange={setPick} disabled={loading} />
        <Button onClick={() => run(pick)} disabled={loading}>Analyze my skills</Button>
        {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
      </Card>

      {loading && !analysis && <LoadingState message="Comparing your skills with the role..." />}

      {analysis && (
        <>
          <Card className="flex flex-col md:flex-row items-center gap-6">
            <Ring value={analysis.readiness} />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold font-heading">{analysis.readiness}% ready for {analysis.targetRole}</h2>
              <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1">
                {analysis.existingStrengths.length} covered, {analysis.skillsToImprove.length} to improve, {analysis.missingSkills.length} missing.
              </p>
              {analysis.basedOn && (
                <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-2">
                  Based on {analysis.basedOn.declaredSkills} skill{analysis.basedOn.declaredSkills === 1 ? '' : 's'} in your profile{analysis.basedOn.usedResume ? ' and your latest resume check' : ''}.{' '}
                  {analysis.basedOn.declaredSkills === 0 && !analysis.basedOn.usedResume && (
                    <>Add skills in <Link className="underline text-[#C85232]" to="/onboarding/skills">your profile</Link> or <Link className="underline text-[#C85232]" to="/hub/resume">check a resume</Link> for a real result.</>
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
                <Button onClick={() => next('/hub/roadmap')}>Create my roadmap</Button>
                <Button variant="secondary" onClick={() => next('/hub/study-plan')}>Make a study plan</Button>
              </div>
            </div>
          </Card>

          <section>
            <h2 className="text-lg font-bold font-heading mb-3">What this role needs</h2>
            <div className="space-y-2">
              {analysis.items.map((i) => {
                const s = STATUS[i.status];
                const Icon = s.icon;
                return (
                  <Card key={i.label} padding="compact" className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{i.label}</p>
                      <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{WEIGHT[i.weight]}{i.status !== 'missing' ? ` • evidence ${Math.round(i.evidence * 100)}%` : ''}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${s.cls}`}><Icon size={14} /> {s.label}</span>
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold font-heading mb-3">Suggested learning order</h2>
            {analysis.learningOrder.length === 0 ? (
              <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">You already cover everything this role asks for. Build projects and practise interviews next.</p>
            ) : (
              <ol className="space-y-2">
                {analysis.learningOrder.map((s, idx) => (
                  <Card key={s.topicId} padding="compact" className="flex items-start gap-3">
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-[#C85232] text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{s.title} <span className="font-normal text-xs text-[#5E5B56] dark:text-[#A0A0A0]">• about {s.hours} hours</span></p>
                      <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{s.reason}</p>
                    </div>
                  </Card>
                ))}
              </ol>
            )}
            {analysis.learningOrder.length > 0 && (
              <button type="button" onClick={() => next('/hub/roadmap')} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#C85232]">
                Turn this into a roadmap with resources <ArrowRight size={14} />
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
