import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CalendarDays, CheckSquare, ChevronDown, ChevronUp, Square, Trash2 } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import RolePicker, { selectClass, useProfileRole } from '../../components/hub/RolePicker';
import {
  deleteStudyPlan, errorMessage, generateStudyPlan, getStudyPlanById, getUserStudyPlans, saveStudyPlanProgress,
} from '../../services/learningService';

const WEEKS = [2, 4, 6, 8, 12, 16, 20, 26];
const HOURS = [6, 10, 15, 20, 30];
const KIND = {
  learn: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  project: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  practice: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  revision: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  mock: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
};
const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StudyPlan() {
  const [params] = useSearchParams();
  const { profileRoleId, loaded } = useProfileRole();
  const [pick, setPick] = useState({ roleId: params.get('role') || 'software-engineer', stackId: params.get('stack') || '' });
  const [weeks, setWeeks] = useState(8);
  const [hours, setHours] = useState(10);
  const [level, setLevel] = useState('Intermediate');

  const [list, setList] = useState([]);
  const [current, setCurrent] = useState(null);
  const [done, setDone] = useState(new Set());
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saveTimer = useRef(null);

  const show = useCallback((p) => {
    setCurrent(p);
    setDone(new Set(p.completed));
    setOpen({ 1: true });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setPick((p) => ({ ...p, roleId: params.get('role') || profileRoleId || p.roleId }));
    (async () => {
      try {
        const plans = await getUserStudyPlans();
        setList(plans);
        if (plans[0]) show(await getStudyPlanById(plans[0].id));
      } catch (err) {
        setError(errorMessage(err, 'Could not load your study plans.'));
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
      const p = await generateStudyPlan({ roleId: pick.roleId, stackId: pick.stackId || null, weeks, hoursPerWeek: hours, level });
      show(p);
      setList(await getUserStudyPlans());
    } catch (err) {
      setError(errorMessage(err, 'Could not create the plan. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => {
    const next = new Set(done);
    next.has(id) ? next.delete(id) : next.add(id);
    setDone(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveStudyPlanProgress(current.id, [...next]).catch(() => setError('Could not save your progress.')), 600);
  };

  const remove = async () => {
    if (!window.confirm('Delete this study plan?')) return;
    await deleteStudyPlan(current.id);
    const rest = await getUserStudyPlans();
    setList(rest);
    if (rest[0]) show(await getStudyPlanById(rest[0].id)); else setCurrent(null);
  };

  const plan = current?.data;
  const taskIds = useMemo(() => (plan ? plan.weeklySchedule.flatMap((w) => w.dailyTasks.map((t) => t.id)) : []), [plan]);
  const pct = taskIds.length ? Math.round((taskIds.filter((i) => done.has(i)).length / taskIds.length) * 100) : 0;
  const trimmed = plan?.coverage.trimmed.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={CalendarDays}>STUDY PLAN</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">A week-by-week schedule that fits your time</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Choose how many weeks and hours you have. The plan fits your roadmap into that time and tells you plainly if it cannot all fit.
        </p>
      </div>

      <Card className="space-y-4">
        <RolePicker roleId={pick.roleId} stackId={pick.stackId} onChange={setPick} disabled={busy} />
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block text-sm font-semibold">Time until your target
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} disabled={busy} className={selectClass}>
              {WEEKS.map((w) => <option key={w} value={w}>{w} weeks</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Hours each week
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} disabled={busy} className={selectClass}>
              {HOURS.map((h) => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">How fast you learn
            <select value={level} onChange={(e) => setLevel(e.target.value)} disabled={busy} className={selectClass}>
              <option value="Beginner">Slowly (needs more time)</option>
              <option value="Intermediate">Average</option>
              <option value="Advanced">Quickly (needs less time)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy}>{busy ? 'Building...' : current ? 'Create a new plan' : 'Create my plan'}</Button>
          {list.length > 1 && (
            <select aria-label="Earlier plans" value={current?.id ?? ''} onChange={async (e) => show(await getStudyPlanById(Number(e.target.value)))} className={`${selectClass} !mt-0 max-w-xs`}>
              {list.map((p) => <option key={p.id} value={p.id}>{p.title} • {new Date(p.createdAt).toLocaleDateString()}</option>)}
            </select>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
      </Card>

      {loading && <LoadingState message="Loading your study plans..." />}

      {plan && (
        <>
          <Card className="space-y-3">
            <h2 className="text-xl font-bold font-heading">{plan.title}</h2>
            <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${trimmed ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
              {trimmed && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
              <p>{plan.coverage.note}</p>
            </div>
            <div>
              <div className="flex justify-between text-xs font-semibold"><span>Tasks done</span><span>{pct}%</span></div>
              <div className="h-2 rounded-full bg-[rgba(0,0,0,0.08)] dark:bg-[rgba(255,255,255,0.1)] mt-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 rounded-full bg-[#C85232]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {plan.weeklySchedule.map((w) => {
              const ids = w.dailyTasks.map((t) => t.id);
              const n = ids.filter((i) => done.has(i)).length;
              const byDay = DAY_ORDER.map((d) => [d, w.dailyTasks.filter((t) => t.day === d)]).filter(([, t]) => t.length);
              return (
                <Card key={w.weekNumber} padding="compact">
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [w.weekNumber]: !o[w.weekNumber] }))} className="w-full flex items-center justify-between gap-3 text-left" aria-expanded={!!open[w.weekNumber]}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#C85232]">Week {w.weekNumber} • {n}/{ids.length} done</p>
                      <h3 className="font-bold font-heading">{w.focusTopic}</h3>
                    </div>
                    {open[w.weekNumber] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {open[w.weekNumber] && (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm"><span className="font-semibold">Goal:</span> {w.weeklyGoal}</p>
                      {byDay.map(([day, tasks]) => (
                        <div key={day}>
                          <p className="text-xs font-semibold uppercase text-[#5E5B56] dark:text-[#A0A0A0] mb-1">{day}</p>
                          <ul className="space-y-1.5">
                            {tasks.map((t) => (
                              <li key={t.id}>
                                <button type="button" onClick={() => toggle(t.id)} aria-pressed={done.has(t.id)} className="flex items-start gap-2 text-left w-full">
                                  {done.has(t.id) ? <CheckSquare size={16} className="text-emerald-600 mt-0.5 shrink-0" /> : <Square size={16} className="mt-0.5 shrink-0" />}
                                  <span className={`text-sm ${done.has(t.id) ? 'line-through opacity-60' : ''}`}>{t.text}</span>
                                  <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND[t.kind]}`}>{t.hours}h</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600"><Trash2 size={14} /> Delete this plan</button>
        </>
      )}
    </div>
  );
}
