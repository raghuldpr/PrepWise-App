import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Briefcase, Code2, Lock, MessagesSquare, Play, Shuffle, UserCheck } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import { selectClass, useProfileRole } from '../../components/hub/RolePicker';
import { createInterview, errorMessage, getInterviewOptions, getUserInterviewHistory } from '../../services/interviewService';

const TYPE_ICON = { TECHNICAL: Code2, HR: UserCheck, MIXED: Shuffle };
const DIFFICULTY_HELP = {
  EASY: 'Fundamentals and common questions',
  MEDIUM: 'Typical campus interview level',
  HARD: 'Deeper questions and trade-offs',
};
const COUNTS = [3, 5, 8, 10];

export default function Setup() {
  const navigate = useNavigate();
  const { profileRoleId, loaded } = useProfileRole();
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState({ interviewType: 'TECHNICAL', difficulty: 'MEDIUM', numberOfQuestions: 5, roleId: '', customRole: '', companyName: '' });
  const [inProgress, setInProgress] = useState([]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getInterviewOptions(), getUserInterviewHistory().catch(() => [])])
      .then(([opts, history]) => {
        if (cancelled) return;
        setOptions(opts);
        setInProgress(history.filter((h) => h.status === 'IN_PROGRESS' && h.answeredCount > 0).slice(0, 2));
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err, 'Could not load the interview options.')));
    return () => { cancelled = true; };
  }, []);

  // Default the role to the profile's target role once both are known.
  useEffect(() => {
    if (!options || !loaded) return;
    setForm((f) => (f.roleId ? f : { ...f, roleId: profileRoleId ?? options.roles[0].id }));
  }, [options, loaded, profileRoleId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      const iv = await createInterview({
        interviewType: form.interviewType,
        difficulty: form.difficulty,
        numberOfQuestions: form.numberOfQuestions,
        roleId: form.roleId,
        targetRole: form.customRole.trim() || null,
        companyName: form.companyName.trim() || null,
      });
      navigate(`/interview/session/${iv.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not start the interview. Please try again.'));
      setStarting(false);
    }
  };

  if (loadError) return <div className="max-w-3xl mx-auto py-12 px-4"><p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {loadError}</p></div>;
  if (!options) return <div className="max-w-3xl mx-auto py-12 px-4"><LoadingState message="Loading interview options..." /></div>;

  const available = options.types.find((t) => t.id === form.interviewType)?.available ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={MessagesSquare}>MOCK INTERVIEW</Badge>
        <h1 className="text-3xl font-extrabold font-heading mt-2">Practise a real interview round</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          You get one question at a time, like a real round. Answers are scored by which key ideas they cover and how they are structured, with no AI involved. You see the full feedback at the end.
        </p>
      </div>

      {inProgress.length > 0 && (
        <Card padding="compact" className="space-y-2">
          <p className="text-sm font-semibold">Unfinished interviews</p>
          {inProgress.map((iv) => (
            <div key={iv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{iv.targetRole} • {iv.interviewType.toLowerCase()} • {iv.answeredCount} of {iv.questionCount} answered</span>
              <Link to={`/interview/session/${iv.id}`} className="font-semibold text-[#C85232] inline-flex items-center gap-1"><Play size={14} /> Continue</Link>
            </div>
          ))}
        </Card>
      )}

      <section>
        <h2 className="text-lg font-bold font-heading mb-3">1. Type of round</h2>
        <div className="grid md:grid-cols-3 gap-3" role="radiogroup" aria-label="Interview type">
          {options.types.map((t) => {
            const Icon = TYPE_ICON[t.id];
            const selected = form.interviewType === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={selected} onClick={() => set({ interviewType: t.id })}
                className={`text-left rounded-2xl border-2 p-4 transition-all ${selected ? 'border-[#C85232] bg-[#C85232]/5' : 'border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.12)] hover:border-[#C85232]/50'}`}>
                <div className="flex items-center gap-2 font-bold"><Icon size={18} className="text-[#C85232]" /> {t.title}</div>
                <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-1">{t.description}</p>
                <p className="text-[11px] mt-2 text-[#5E5B56] dark:text-[#A0A0A0]">{t.available} questions in the bank</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-2 inline-flex items-center gap-1.5">
          <Lock size={12} /> Coding rounds with a code editor arrive with the coding practice module, not here.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold font-heading inline-flex items-center gap-2"><Briefcase size={18} className="text-[#C85232]" /> 2. Role</h2>
          <label className="block text-sm font-semibold">
            Target role
            <select className={selectClass} value={form.roleId} onChange={(e) => set({ roleId: e.target.value })}>
              {options.roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Job title to show (optional)
            <input className={selectClass} value={form.customRole} maxLength={200} onChange={(e) => set({ customRole: e.target.value })} placeholder="e.g. iOS Mobile Engineer" />
          </label>
          <label className="block text-sm font-semibold">
            Company you are preparing for (optional)
            <input className={selectClass} value={form.companyName} maxLength={120} onChange={(e) => set({ companyName: e.target.value })} placeholder="e.g. TCS" />
          </label>
          <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
            The role decides which technical topics are preferred. The job title and company are labels for your history; questions are not company-specific.
          </p>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold font-heading">3. Difficulty and length</h2>
          <div>
            <p className="text-sm font-semibold mb-2">Starting difficulty</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
              {options.difficulties.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={form.difficulty === d} onClick={() => set({ difficulty: d })}
                  className={`rounded-xl border py-2 text-xs font-bold uppercase tracking-wider ${form.difficulty === d ? 'bg-[#C85232] border-[#C85232] text-white' : 'border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)] hover:border-[#C85232]/60'}`}>
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-2">{DIFFICULTY_HELP[form.difficulty]}. Two strong answers in a row make the next question harder; two weak ones make it easier.</p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Number of questions</p>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Number of questions">
              {COUNTS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={form.numberOfQuestions === n} onClick={() => set({ numberOfQuestions: n })}
                  className={`rounded-xl border py-2 text-sm font-bold ${form.numberOfQuestions === n ? 'bg-[#C85232] border-[#C85232] text-white' : 'border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)] hover:border-[#C85232]/60'}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-2">About {form.numberOfQuestions * (form.interviewType === 'HR' ? 2 : 3)} minutes.</p>
          </div>
        </Card>
      </section>

      {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={start} disabled={starting || !form.roleId || form.numberOfQuestions > available} loading={starting}>
          Start interview <ArrowRight size={16} />
        </Button>
        <Link to="/interview/history" className="text-sm font-semibold text-[#C85232]">See past interviews</Link>
      </div>
    </div>
  );
}
