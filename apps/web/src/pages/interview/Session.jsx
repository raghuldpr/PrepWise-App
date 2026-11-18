import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Clock, LogOut, Mic, MicOff, SkipForward, Send, Volume2 } from 'lucide-react';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { answerQuestion, completeInterview, deleteInterview, errorMessage, getInterview } from '../../services/interviewService';

const GUIDANCE = {
  TECHNICAL: 'Define it in a sentence, explain how it works, then give a short example. Mention trade-offs where they matter.',
  HR: 'Tell a real story: the situation, what you personally did, and the result. Say "I", and include a number if you can.',
};
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Session() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'skip' | 'end' | null
  const [elapsed, setElapsed] = useState(0);
  const [listening, setListening] = useState(false);
  const questionStart = useRef(Date.now());
  const recognition = useRef(null);
  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getInterview(id);
      if (data.status === 'COMPLETED') { navigate(`/interview/report/${id}`, { replace: true }); return; }
      setInterview(data);
      setQuestion(data.currentQuestion);
      questionStart.current = Date.now();
    } catch (err) {
      setLoadError(err.response?.status === 404 ? 'This interview was not found.' : errorMessage(err, 'Could not load the interview.'));
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { clearInterval(t); window.speechSynthesis?.cancel(); try { recognition.current?.stop(); } catch { /* ignore */ } };
  }, []);

  const toggleListening = () => {
    if (listening) { recognition.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false; // final results only, so the text is never duplicated
    rec.lang = 'en-IN';
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) setAnswer((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${text.trim()}`);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  const readAloud = () => {
    if (!ttsSupported || !question) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(question.questionText));
  };

  const submit = async (skipped) => {
    if (!question || submitting) return;
    if (!skipped && !answer.trim()) { setError('Write your answer first, or skip the question.'); return; }
    setSubmitting(true);
    setError('');
    setConfirm(null);
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
    try {
      const res = await answerQuestion(id, {
        questionId: question.id,
        answerText: skipped ? '' : answer.trim(),
        skipped,
        secondsTaken: Math.min(7200, Math.round((Date.now() - questionStart.current) / 1000)),
      });
      if (res.done) { navigate(`/interview/report/${id}`); return; }
      setQuestion(res.nextQuestion);
      setInterview((iv) => ({ ...iv, answeredCount: res.answeredCount }));
      setAnswer('');
      questionStart.current = Date.now();
    } catch (err) {
      if (err.response?.status === 409) { await load(); setError('The interview moved on; here is the current question.'); }
      else setError(errorMessage(err, 'Could not save your answer. Your text is still here; try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const endNow = async () => {
    setConfirm(null);
    if (!interview?.answeredCount) {
      try { await deleteInterview(id); } catch { /* leaving anyway */ }
      navigate('/interview/setup/role');
      return;
    }
    try {
      await completeInterview(id);
      navigate(`/interview/report/${id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not end the interview.'));
    }
  };

  if (loading) return <LoadingState message="Opening your interview..." />;
  if (loadError || !interview || !question) return <ErrorState message={loadError || 'This interview has no question to show.'} onRetry={load} />;

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const pct = ((question.questionOrder - 1) / question.totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-canvas text-[#111111] dark:text-[#E4E4E7] font-body">
      <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-[rgba(0,0,0,0.08)] dark:border-neutral-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold font-heading truncate">{interview.targetRole}{interview.companyName ? ` • ${interview.companyName}` : ''}</p>
            <p className="text-xs text-[#5E5B56] dark:text-neutral-400">Question {question.questionOrder} of {question.totalQuestions} • {question.kind === 'HR' ? 'HR' : 'Technical'}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono"><Clock size={14} className="text-[#C85232]" /> {mmss(elapsed)}</span>
            <button type="button" onClick={() => setConfirm('end')} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.12)] dark:border-neutral-700 hover:border-[#C85232]">
              <LogOut size={14} /> End interview
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto mt-2 h-1.5 rounded-full bg-[#EAE6DF] dark:bg-neutral-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={question.totalQuestions} aria-valuenow={question.questionOrder - 1}>
          <div className="h-full bg-[#C85232] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <section className="bg-surface border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-[#C85232]/15 text-[#C85232] text-xs font-bold uppercase tracking-wider border border-[#C85232]/30">{question.topic}</span>
            {ttsSupported && (
              <button type="button" onClick={readAloud} className="text-xs text-[#C85232] font-semibold inline-flex items-center gap-1"><Volume2 size={14} /> Read aloud</button>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold font-heading leading-snug">{question.questionText}</h1>
          <p className="text-xs text-[#5E5B56] dark:text-neutral-400 mt-3">
            {GUIDANCE[question.kind]}{question.kind === 'TECHNICAL' ? ` A full answer touches about ${question.ideaCount} key ideas.` : ''}
          </p>
        </section>

        <section className="bg-surface border border-[rgba(0,0,0,0.08)] dark:border-neutral-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="answer" className="text-sm font-bold">Your answer</label>
            {speechSupported && (
              <button type="button" onClick={toggleListening} aria-pressed={listening}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 ${listening ? 'border-rose-500 text-rose-600 animate-pulse' : 'border-[rgba(0,0,0,0.12)] dark:border-neutral-700'}`}>
                {listening ? <MicOff size={14} /> : <Mic size={14} />} {listening ? 'Stop dictating' : 'Dictate'}
              </button>
            )}
          </div>
          <textarea id="answer" value={answer} rows={9} maxLength={4000} disabled={submitting}
            onChange={(e) => { setAnswer(e.target.value); if (error) setError(''); }}
            placeholder="Type your answer here, as you would say it in the interview."
            className="w-full rounded-xl p-4 text-sm leading-relaxed bg-[#FAF8F5] dark:bg-[#0E0E10] border border-[rgba(0,0,0,0.1)] dark:border-neutral-800 focus:outline-none focus:border-[#C85232]" />
          <p className="text-xs text-[#5E5B56] dark:text-neutral-400">{words} words{question.kind === 'HR' ? ' (aim for 60 to 120)' : ' (aim for 40 to 80)'}</p>
          {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-center gap-1.5"><AlertCircle size={16} /> {error}</p>}
        </section>

        <div className="flex items-center justify-between">
          <Button variant="secondary" disabled={submitting} onClick={() => setConfirm('skip')}><SkipForward size={14} /> Skip</Button>
          <Button disabled={submitting} loading={submitting} onClick={() => submit(false)}>
            {question.questionOrder === question.totalQuestions ? 'Submit and finish' : 'Submit answer'} <Send size={14} />
          </Button>
        </div>
        <p className="text-xs text-center text-[#5E5B56] dark:text-neutral-400">Scores and feedback appear in your report when the interview ends.</p>
      </main>

      {confirm === 'skip' && (
        <Modal isOpen onClose={() => setConfirm(null)} title="Skip this question?">
          <p className="text-sm">A skipped question scores 0 in your report, and you will still see the model answer there.</p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setConfirm(null)}>Keep answering</Button>
            <Button onClick={() => submit(true)}>Skip it</Button>
          </div>
        </Modal>
      )}
      {confirm === 'end' && (
        <Modal isOpen onClose={() => setConfirm(null)} title="End the interview?">
          <p className="text-sm">
            {interview.answeredCount
              ? `You have answered ${interview.answeredCount} of ${question.totalQuestions}. Your report will cover only those questions.`
              : 'You have not answered anything yet, so this interview will be discarded.'}
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="secondary" onClick={() => setConfirm(null)}>Continue</Button>
            <Button variant="danger" onClick={endNow}>{interview.answeredCount ? 'End and see report' : 'Discard'}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
