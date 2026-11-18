import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart2, Play, Plus, Trash2 } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { deleteInterview, errorMessage, getUserInterviewHistory } from '../../services/interviewService';

const FILTERS = [['ALL', 'All'], ['TECHNICAL', 'Technical'], ['HR', 'HR'], ['MIXED', 'Mixed']];
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

export default function History() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getUserInterviewHistory());
    } catch (err) {
      setError(errorMessage(err, 'Could not load your interviews.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === 'COMPLETED');
    // Trend: newest three completed interviews against the three before them (needs at least four).
    const scores = done.map((i) => i.overallScore);
    const trend = scores.length >= 4 ? avg(scores.slice(0, 3)) - avg(scores.slice(3, 6)) : null;
    return { done: done.length, average: done.length ? avg(scores) : null, best: done.length ? Math.max(...scores) : null, trend };
  }, [items]);

  const remove = async (id) => {
    if (!window.confirm('Delete this interview and its report? This cannot be undone.')) return;
    setNotice('');
    try {
      await deleteInterview(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (err) {
      setNotice(errorMessage(err, 'Could not delete it.'));
    }
  };

  if (loading) return <LoadingState message="Loading your interviews..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const shown = items.filter((i) => filter === 'ALL' || i.interviewType === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <div>
          <Badge variant="primary" icon={BarChart2}>MOCK INTERVIEWS</Badge>
          <h1 className="text-3xl font-extrabold font-heading mt-2">Your interviews</h1>
          <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1">Every round you practised, with its report. The newest 50 are kept.</p>
        </div>
        <Button onClick={() => navigate('/interview/setup/role')}><Plus size={16} /> New interview</Button>
      </div>

      {items.length > 0 && (
        <div className="grid sm:grid-cols-4 gap-4">
          <Card padding="compact"><p className="text-xs uppercase font-bold text-[#5E5B56] dark:text-[#A0A0A0]">Completed</p><p className="text-3xl font-extrabold font-mono">{stats.done}</p></Card>
          <Card padding="compact"><p className="text-xs uppercase font-bold text-[#5E5B56] dark:text-[#A0A0A0]">Average score</p><p className="text-3xl font-extrabold font-mono text-[#C85232]">{stats.average ?? '-'}</p></Card>
          <Card padding="compact"><p className="text-xs uppercase font-bold text-[#5E5B56] dark:text-[#A0A0A0]">Best score</p><p className="text-3xl font-extrabold font-mono">{stats.best ?? '-'}</p></Card>
          <Card padding="compact">
            <p className="text-xs uppercase font-bold text-[#5E5B56] dark:text-[#A0A0A0]">Recent trend</p>
            <p className={`text-3xl font-extrabold font-mono ${stats.trend === null ? '' : stats.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{stats.trend === null ? '-' : `${stats.trend > 0 ? '+' : ''}${stats.trend}`}</p>
            <p className="text-[11px] text-[#5E5B56] dark:text-[#A0A0A0]">{stats.trend === null ? 'After 4 completed interviews' : 'Last 3 against the 3 before'}</p>
          </Card>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex gap-2" role="group" aria-label="Filter by type">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === key ? 'bg-[#C85232] border-[#C85232] text-white' : 'border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]'}`}>{label}</button>
          ))}
        </div>
      )}
      {notice && <p role="alert" className="text-sm text-rose-600">{notice}</p>}

      {items.length === 0 ? (
        <EmptyState title="No interviews yet" description="Take your first mock interview and get a report on which ideas you covered and what to revise." actionLabel="Start an interview" onAction={() => navigate('/interview/setup/role')} />
      ) : shown.length === 0 ? (
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0]">No interviews of this type yet.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => {
            const done = i.status === 'COMPLETED';
            return (
              <li key={i.id}>
                <Card padding="compact" className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold font-heading truncate">{i.targetRole}{i.companyName ? ` • ${i.companyName}` : ''}</p>
                    <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
                      {new Date(i.createdAt).toLocaleDateString()} • {i.interviewType.toLowerCase()} • {i.difficulty.toLowerCase()} • {i.answeredCount} of {i.questionCount} answered
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {done ? (
                      <div className="text-right"><p className="text-[10px] uppercase font-bold text-[#5E5B56] dark:text-[#A0A0A0]">Score</p><p className="text-xl font-extrabold font-mono text-[#C85232]">{i.overallScore}</p></div>
                    ) : <Badge>In progress</Badge>}
                    {done ? (
                      <Link to={`/interview/report/${i.id}`} className="text-sm font-bold text-[#C85232] inline-flex items-center gap-1">Report <ArrowRight size={14} /></Link>
                    ) : (
                      <Link to={`/interview/session/${i.id}`} className="text-sm font-bold text-[#C85232] inline-flex items-center gap-1"><Play size={14} /> Continue</Link>
                    )}
                    <button type="button" aria-label="Delete interview" onClick={() => remove(i.id)} className="text-[#5E5B56] dark:text-[#A0A0A0] hover:text-rose-600"><Trash2 size={16} /></button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
