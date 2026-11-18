import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronUp, FileText, Loader2, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { ROLES } from '@prepwise/content';
import { analyzeResume } from '@prepwise/core';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { deleteResume, getUserResumes, saveAnalysis } from '../../services/resumeService';
import { ExtractError, MAX_FILE_BYTES, extractResumeText } from '../../lib/extractText';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const scoreColor = (s) => (s >= 80 ? 'text-emerald-600' : s >= 65 ? 'text-amber-600' : 'text-rose-600');

export default function ResumeAnalyzer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [roleId, setRoleId] = useState('software-engineer');
  const [showJd, setShowJd] = useState(false);
  const [jd, setJd] = useState('');
  const [step, setStep] = useState(''); // '' | 'reading' | 'analyzing' | 'saving'
  const [formError, setFormError] = useState('');
  const [dragging, setDragging] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      setHistory(await getUserResumes());
    } catch (err) {
      console.error('Failed to load resumes:', err);
      setHistoryError('Could not load your previous resumes.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Pre-select the role from the profile's target role when it matches a known role.
  useEffect(() => {
    api.get('/users/profile').then((res) => {
      const t = (res.data.targetRole || '').toLowerCase();
      // Pick the role whose longest matching keyword is the most specific ("backend" beats "engineer").
      const specificity = (r) => Math.max(0, ...[r.title.toLowerCase(), ...r.titleKeywords].filter((k) => t.includes(k)).map((k) => k.length));
      const best = t ? ROLES.map((r) => [r, specificity(r)]).sort((a, b) => b[1] - a[1])[0] : null;
      if (best && best[1] > 0) setRoleId(best[0].id);
    }).catch(() => {});
  }, []);

  const pick = (f) => {
    setFormError('');
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return setFormError('The file is larger than 5 MB. Upload a smaller file.');
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) return setFormError('Only PDF, DOCX and TXT files are supported.');
    setFile(f);
  };

  const busy = step !== '';

  const analyze = async () => {
    if (!file || busy) return;
    setFormError('');
    try {
      setStep('reading');
      const { text, fileType } = await extractResumeText(file);
      setStep('analyzing');
      await new Promise((r) => setTimeout(r, 50)); // let the UI repaint before the (fast) CPU work
      const role = ROLES.find((r) => r.id === roleId) || ROLES[0];
      const jobDescription = showJd && jd.trim().length >= 40 ? jd.trim() : undefined;
      const result = analyzeResume({ text, roleId: role.id, roleLabel: role.title, jobDescription });
      setStep('saving');
      const saved = await saveAnalysis({
        filename: file.name,
        fileType,
        fileSize: file.size,
        text,
        targetRoleId: role.id,
        targetRole: role.title,
        jobDescription,
        result,
      });
      navigate(`/hub/resume/result/${saved.analysisId}`);
    } catch (err) {
      console.error('Resume analysis failed:', err);
      setFormError(err instanceof ExtractError ? err.message : err.response?.data?.message || 'Something went wrong while analysing the resume. Please try again.');
      setStep('');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this resume and all its analyses? This cannot be undone.')) return;
    try {
      await deleteResume(id);
      setHistory((h) => h.filter((r) => r.id !== id));
    } catch {
      setHistoryError('Could not delete the resume. Please try again.');
    }
  };

  const stepLabel = { reading: 'Reading your file...', analyzing: 'Analysing skills and structure...', saving: 'Saving the result...' }[step];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] pb-4">
        <Badge variant="primary" icon={FileText}>RESUME ANALYZER</Badge>
        <h1 className="text-3xl font-extrabold font-heading text-[#111111] dark:text-white mt-2">Check your resume</h1>
        <p className="text-sm text-[#5E5B56] dark:text-[#A0A0A0] mt-1 max-w-2xl">
          Get a score, the skills we found, what is missing for your target role, and specific fixes. No AI service is involved: the checks are
          rule-based and run in your browser.
        </p>
      </div>

      <Card className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
          onClick={() => !busy && inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-[#C85232] bg-[#C85232]/5' : 'border-[rgba(0,0,0,0.15)] dark:border-[rgba(255,255,255,0.2)]'}`}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" data-testid="resume-file" onChange={(e) => pick(e.target.files?.[0])} />
          <UploadCloud className="mx-auto mb-2 text-[#C85232]" size={32} />
          {file ? (
            <p className="font-semibold">{file.name} <span className="text-xs font-normal text-[#5E5B56] dark:text-[#A0A0A0]">({Math.round(file.size / 1024)} KB)</span></p>
          ) : (
            <>
              <p className="font-semibold">Drop your resume here, or click to choose</p>
              <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] mt-1">PDF, DOCX or TXT, up to 5 MB</p>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="block text-sm font-semibold">
            Target role
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]"
            >
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => setShowJd((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C85232]">
              {showJd ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Match against a job description (optional)
            </button>
          </div>
        </div>

        {showJd && (
          <div>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={6}
              maxLength={20000}
              disabled={busy}
              placeholder="Paste the job posting here. We compare its skills and keywords with your resume."
              className="w-full rounded-xl px-3 py-2 text-sm bg-surface border border-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.12)]"
            />
            <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">At least 40 characters; otherwise the role above is used.</p>
          </div>
        )}

        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/30 p-3 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {formError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0] inline-flex items-center gap-1.5">
            <ShieldCheck size={14} /> Your file is read in your browser. Only the extracted text and the results are saved, and you can delete them anytime.
          </p>
          <Button onClick={analyze} disabled={!file || busy}>
            {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {stepLabel}</span> : 'Analyze resume'}
          </Button>
        </div>
      </Card>

      <section>
        <h2 className="text-lg font-bold font-heading mb-3">Your resumes</h2>
        {loadingHistory ? (
          <LoadingState message="Loading your resumes..." />
        ) : historyError ? (
          <ErrorState message={historyError} onRetry={loadHistory} />
        ) : history.length === 0 ? (
          <EmptyState icon={FileText} title="No resumes yet" description={`Upload your first resume${user?.name ? `, ${user.name.split(' ')[0]}` : ''}, and the analysis will appear here.`} />
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <Card key={r.id} padding="compact" className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="text-left flex-1 min-w-[12rem]"
                  disabled={!r.latestAnalysis}
                  onClick={() => r.latestAnalysis && navigate(`/hub/resume/result/${r.latestAnalysis.id}`)}
                >
                  <p className="font-semibold text-sm">{r.originalFilename}</p>
                  <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">
                    {r.latestAnalysis ? `${r.latestAnalysis.targetRole} • ` : ''}{new Date(r.uploadedAt).toLocaleDateString()} • {r.wordCount} words
                  </p>
                </button>
                {r.latestAnalysis && (
                  <span className={`text-2xl font-extrabold ${scoreColor(r.latestAnalysis.score)}`}>{r.latestAnalysis.score}<span className="text-xs font-normal text-[#5E5B56]">/100</span></span>
                )}
                <button type="button" onClick={() => remove(r.id)} aria-label={`Delete ${r.originalFilename}`} className="p-2 text-[#5E5B56] hover:text-rose-600">
                  <Trash2 size={16} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
