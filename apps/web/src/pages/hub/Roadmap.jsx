import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, CheckSquare, ChevronDown, ChevronUp, ExternalLink, Map as MapIcon, Square, Trash2 } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import RolePicker, { selectClass, useProfileRole } from '../../components/hub/RolePicker';
import {
  deleteRoadmap, errorMessage, generateRoadmap, getRoadmapById, getUserRoadmaps, saveRoadmapProgress,
} from '../../services/learningService';

const HOURS = [6, 10, 15, 20, 30];

export default function Roadmap() {
  const [params] = useSearchParams();
  const { profileRoleId, loaded } = useProfileRole();
  const [pick, setPick] = useState({ roleId: params.get('role') || 'software-engineer', stackId: params.get('stack') || '' });
  const [hours, setHours] = useState(10);

  const [list, setList] = useState([]);
  const [current, setCurrent] = useState(null);
  const [done, setDone] = useState(new Set());
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saveTimer = useRef(null);

  const show = useCallback((rm) => {
    setCurrent(rm);
    setDone(new Set(rm.completed));
    setOpen({ 0: true });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setPick((p) => ({ ...p, roleId: params.get('role') || profileRoleId || p.roleId }));
    (async () => {
      try {
        const rms = await getUserRoadmaps();
        setList(rms);
        if (rms[0]) show(await getRoadmapById(rms[0].id));
      } catch (err) {
        setError(errorMessage(err, 'Could not load your roadmaps.'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const rm = await generateRoadmap({ roleId: pick.roleId, stackId: pick.stackId || null, hoursPerWeek: hours });
      show(rm);
      setList(await getUserRoadmaps());
    } catch (err) {
      setError(errorMessage(err, 'Could not create the roadmap. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => {
    const next = new Set(done);
    next.has(id) ? next.delete(id) : next.add(id);
    setDone(next);
    // save shortly after the last click so rapid ticking is one request
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveRoadmapProgress(current.id, [...next]).catch(() => setError('Could not save your progress.')), 600);
  };

  const remove = async () => {
    if (!window.confirm('Delete this roadmap?')) return;
    await deleteRoadmap(current.id);
    const rest = await getUserRoadmaps();
    setList(rest);
    if (rest[0]) show(await getRoadmapById(rest[0].id)); else setCurrent(null);
  };

  const rm = current?.data;
  const allIds = useMemo(() => (rm ? rm.phases.flatMap((p) => [...p.topics.map((t) => t.id), ...p.projects.map((x) => `project-${x.id}`)]) : []), [rm]);
  const pct = allIds.length ? Math.round((allIds.filter((i) => done.has(i)).length / allIds.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={MapIcon}>LEARNING ROADMAP</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">A step-by-step path to your role</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Built from a curated topic list and your current skills, so you skip what you already know. Every topic has free resources and a practice task.
        </p>
      </div>

      <Card className="space-y-4">
        <RolePicker roleId={pick.roleId} stackId={pick.stackId} onChange={setPick} disabled={busy} />
        <label className="block text-sm font-semibold max-w-xs">
          Time you can study each week
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} disabled={busy} className={selectClass}>
            {HOURS.map((h) => <option key={h} value={h}>{h} hours per week</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy}>{busy ? 'Building...' : current ? 'Create a new roadmap' : 'Create my roadmap'}</Button>
          {list.length > 1 && (
            <select
              aria-label="Earlier roadmaps"
              value={current?.id ?? ''}
              onChange={async (e) => show(await getRoadmapById(Number(e.target.value)))}
              className={`${selectClass} !mt-0 max-w-xs`}
            >
              {list.map((r) => <option key={r.id} value={r.id}>{r.targetRole} • {new Date(r.createdAt).toLocaleDateString()}</option>)}
            </select>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
      </Card>

      {loading && <LoadingState message="Loading your roadmaps..." />}

      {rm && (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-heading">{rm.targetRole}</h2>
                <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">
                  About {rm.totalHours} hours, roughly {rm.estimatedDurationWeeks} weeks at {rm.hoursPerWeek} h/week. You are {rm.readiness}% ready today.
                </p>
              </div>
              <Link to={`/hub/study-plan?role=${rm.roleId}`} className="text-sm font-semibold text-[#C85232]">Turn it into a weekly plan</Link>
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold"><span>Your progress</span><span>{pct}%</span></div>
              <div className="h-2 rounded-full bg-[rgba(0,0,0,0.08)] dark:bg-[rgba(255,255,255,0.1)] mt-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 rounded-full bg-[#C85232]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {rm.gap.existingStrengths.length > 0 && (
              <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">Skipped because you already have them: {rm.gap.existingStrengths.join(', ')}.</p>
            )}
          </Card>

          <div className="space-y-4">
            {rm.phases.map((p, idx) => (
              <Card key={p.phaseNumber} padding="compact">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [idx]: !o[idx] }))} className="w-full flex items-center justify-between gap-3 text-left" aria-expanded={!!open[idx]}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#C85232]">Phase {p.phaseNumber} • about {p.durationWeeks} week{p.durationWeeks > 1 ? 's' : ''} • {p.hours} h</p>
                    <h3 className="font-bold font-heading">{p.phaseTitle}</h3>
                    <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{p.summary}</p>
                  </div>
                  {open[idx] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {open[idx] && (
                  <div className="mt-4 space-y-4">
                    {p.topics.map((t) => (
                      <div key={t.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] p-4">
                        <button type="button" onClick={() => toggle(t.id)} className="flex items-start gap-2 text-left w-full" aria-pressed={done.has(t.id)}>
                          {done.has(t.id) ? <CheckSquare size={18} className="text-emerald-600 mt-0.5 shrink-0" /> : <Square size={18} className="mt-0.5 shrink-0" />}
                          <span>
                            <span className={`font-semibold ${done.has(t.id) ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                            <span className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]"> • about {t.hours} h</span>
                            <span className="block text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{t.reason}</span>
                          </span>
                        </button>
                        <ul className="mt-2 ml-7 list-disc pl-4 text-sm space-y-0.5">{t.outline.map((o) => <li key={o}>{o}</li>)}</ul>
                        {t.practice.length > 0 && (
                          <p className="mt-2 ml-7 text-sm"><span className="font-semibold">Practice:</span> {t.practice.join(' • ')}</p>
                        )}
                        {t.resources.length > 0 && (
                          <p className="mt-2 ml-7 text-sm flex flex-wrap gap-x-4 gap-y-1">
                            {t.resources.map((r) => (
                              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#C85232] font-semibold">
                                <BookOpen size={13} /> {r.title} <ExternalLink size={12} />
                              </a>
                            ))}
                          </p>
                        )}
                      </div>
                    ))}
                    {p.projects.map((x) => (
                      <div key={x.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] p-4">
                        <button type="button" onClick={() => toggle(`project-${x.id}`)} className="flex items-start gap-2 text-left w-full" aria-pressed={done.has(`project-${x.id}`)}>
                          {done.has(`project-${x.id}`) ? <CheckSquare size={18} className="text-emerald-600 mt-0.5 shrink-0" /> : <Square size={18} className="mt-0.5 shrink-0" />}
                          <span className="font-semibold">Project: {x.title} <span className="text-xs font-normal text-[#5E5B56] dark:text-[#A0A0A0]">• about {x.hours} h • {x.difficulty.toLowerCase()}</span></span>
                        </button>
                        <Link to={`/hub/projects/${x.id}`} className="ml-7 text-sm font-semibold text-[#C85232]">See the full project plan</Link>
                      </div>
                    ))}
                    {p.milestones.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold">Phase checkpoints</p>
                        <ul className="list-disc pl-5 text-sm space-y-0.5">{p.milestones.map((m) => <li key={m}>{m}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600"><Trash2 size={14} /> Delete this roadmap</button>
        </>
      )}
    </div>
  );
}
