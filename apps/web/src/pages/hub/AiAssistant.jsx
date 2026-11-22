import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, Image as ImageIcon, Info, Loader2, MessageSquare, Plus, Send, Trash2, User, X } from 'lucide-react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import FormattedMarkdown from '../../components/common/FormattedMarkdown';
import CareerHubHeader from '../../components/hub/CareerHubHeader';
import { deleteAiConversation, errorMessage, getAiConversation, getAiConversations, getAiStatus, sendAiMessage } from '../../services/aiService';
import { resizeImage } from '../../lib/resizeImage';
import { searchStudy } from '../../lib/studyIndex';

const STARTERS = [
  'How should I explain my final year project in a technical interview?',
  'What should I revise in 2 weeks before a campus placement test?',
  'Explain deadlock like I am a beginner, with an example.',
  'How do I answer "What is your biggest weakness?" honestly?',
];

const PROVIDER_LABEL = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter' };

function Disabled({ reason }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <CareerHubHeader />
      <Card className="space-y-4">
        <Badge variant="primary" icon={Bot}>AI ASSISTANT (OPTIONAL)</Badge>
        <h1 className="text-2xl font-extrabold font-heading">The AI assistant is not switched on</h1>
        <p className="text-sm">{reason} Everything else in PrepWise works without it: your skill gap, roadmap, study plan, resume check, mock interviews and coding practice are all rule-based.</p>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link className="text-[#C85232] underline" to="/hub/search">Study search</Link>
          <Link className="text-[#C85232] underline" to="/hub/skill-gap">Skill gap</Link>
          <Link className="text-[#C85232] underline" to="/interview/setup/role">Mock interview</Link>
          <Link className="text-[#C85232] underline" to="/placement/coding">Coding practice</Link>
        </div>
        <p className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">Site owner: set <code>AI_ENABLED = "true"</code> and add at least one provider key as a secret (see the README) to turn it on.</p>
      </Card>
    </div>
  );
}

export default function AiAssistant() {
  const [status, setStatus] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [shareContext, setShareContext] = useState(false);
  const [useSources, setUseSources] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [loadError, setLoadError] = useState('');
  const endRef = useRef(null);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    const [s, list] = await Promise.all([getAiStatus(), getAiConversations().catch(() => [])]);
    setStatus(s);
    setConversations(list);
  }, []);

  useEffect(() => { refresh().catch((err) => setLoadError(errorMessage(err, 'Could not load the assistant.'))); }, [refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => () => { if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl); }, [image]);

  const open = async (id) => {
    setError(''); setNote('');
    try {
      const c = await getAiConversation(id);
      setActiveId(id);
      setMessages(c.messages.map((m) => ({ role: m.role, content: m.content, hadImage: m.hadImage, provider: m.provider, sources: m.sources ?? [] })));
    } catch (err) { setError(errorMessage(err, 'Could not open that conversation.')); }
  };
  const fresh = () => { setActiveId(null); setMessages([]); setError(''); setNote(''); setImage(null); };
  const remove = async (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await deleteAiConversation(id);
      if (id === activeId) fresh();
      setConversations((xs) => xs.filter((x) => x.id !== id));
    } catch (err) { setError(errorMessage(err, 'Could not delete it.')); }
  };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try { setImage(await resizeImage(file)); } catch (err) { setError(err.message); }
  };

  // When the AI cannot answer (daily limit used, every provider out of quota or down), the student still gets help:
  // the closest passages from PrepWise's own study material, found on this device. It is labelled as a search result.
  const studyFallback = async (message, reason) => {
    let hits = [];
    try { hits = await searchStudy(message, { k: 4, minScore: 0.1 }); } catch { /* the material could not load either */ }
    const sources = hits.map((h, i) => ({ n: i + 1, id: h.id, title: h.passage.title, link: h.passage.link, snippet: h.passage.text.slice(0, 220) }));
    const content = hits.length
      ? `${reason} Here is the closest material from PrepWise's own notes instead. This is a search result, not an AI answer.`
      : `${reason} I could not find matching study material for that question either. Try the Study search page with other words.`;
    setMessages((m) => [...m, { role: 'assistant', content, sources, fallback: true }]);
  };

  const send = async (override) => {
    const message = (override ?? text).trim();
    if (!message || sending) return;
    setSending(true); setError(''); setNote('');
    const attached = image;
    setMessages((m) => [...m, { role: 'user', content: message, hadImage: !!attached, preview: attached?.previewUrl }]);
    setText(''); setImage(null);
    if (status && status.dailyLimit - status.usedToday <= 0) {
      await studyFallback(message, "You have used all of today's AI messages (they reset at midnight UTC).");
      setSending(false);
      return;
    }
    try {
      // Find study passages on this device first (TF-IDF); only their ids are sent, and the server rebuilds the text.
      let sourceIds = [];
      if (useSources) {
        try { sourceIds = (await searchStudy(message, { k: 4, minScore: 0.12 })).map((h) => h.id); } catch { /* answer without sources */ }
      }
      const res = await sendAiMessage({
        conversationId: activeId, message, shareContext, sourceIds,
        image: attached ? { mimeType: attached.mimeType, dataBase64: attached.dataBase64 } : null,
      });
      setActiveId(res.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: res.reply.content, provider: res.reply.provider, sources: res.reply.sources ?? [] }]);
      setStatus((s) => ({ ...s, usedToday: res.usedToday }));
      if (res.fellBack) {
        const failed = res.attempts.filter((a) => !a.ok).map((a) => `${PROVIDER_LABEL[a.provider] ?? a.provider} (${a.reason})`).join(', ');
        setNote(`Answered by ${PROVIDER_LABEL[res.reply.provider] ?? res.reply.provider} after ${failed} failed.`);
      }
      refresh().catch(() => {});
    } catch (err) {
      const code = err.response?.status;
      // Limits and outages (429 limit or rate limit, 502 every provider failed, 503/504, no connection): fall back to search.
      if (!err.response || [429, 502, 503, 504].includes(code)) {
        await studyFallback(message, errorMessage(err, 'The AI assistant could not be reached.'));
        if (code === 429) refresh().catch(() => {});
      } else {
        setMessages((m) => m.slice(0, -1)); // a request problem (for example a bad image): take the question back out so it can be fixed
        setText(message); setImage(attached);
        setError(errorMessage(err, 'Could not reach the assistant. Please try again.'));
      }
    } finally { setSending(false); }
  };

  if (loadError) return <div className="max-w-3xl mx-auto py-12"><p role="alert" className="text-sm text-rose-600">{loadError}</p></div>;
  if (!status) return <LoadingState message="Checking the assistant..." />;
  if (!status.enabled) return <Disabled reason={status.reason ?? 'It has not been enabled.'} />;

  const left = Math.max(0, status.dailyLimit - status.usedToday);

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      <CareerHubHeader />
      <div className="grid lg:grid-cols-[250px,1fr] gap-4 items-start">
        <Card padding="compact" className="space-y-3">
          <Button onClick={fresh} className="w-full"><Plus size={14} /> New chat</Button>
          <ul className="space-y-1 max-h-72 overflow-y-auto">
            {conversations.length === 0 && <li className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">No chats yet.</li>}
            {conversations.map((c) => (
              <li key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === activeId ? 'bg-[#C85232]/10' : ''}`}>
                <button type="button" onClick={() => open(c.id)} className="flex-1 min-w-0 text-left px-2 py-1.5 text-xs inline-flex items-center gap-1.5"><MessageSquare size={13} className="shrink-0" /><span className="truncate">{c.title}</span></button>
                <button type="button" aria-label={`Delete ${c.title}`} onClick={() => remove(c.id)} className="p-1 text-[#5E5B56] hover:text-rose-600"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#5E5B56] dark:text-[#A0A0A0]">{left} of {status.dailyLimit} messages left today. Up to the newest 30 chats are kept.</p>
        </Card>

        <div className="space-y-3 min-w-0">
          <div role="note" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <Info size={15} className="shrink-0 mt-0.5 text-amber-600" />
            <span>Your messages and any image are sent to an outside AI provider ({status.providers.map((p) => PROVIDER_LABEL[p.id] ?? p.id).join(', ')}), which may keep them under its own policy. Do not share passwords, ID numbers or other private details. Answers can be wrong: check anything important.</span>
          </div>

          <Card padding="compact" className="min-h-[320px] max-h-[60vh] overflow-y-auto space-y-4" aria-live="polite">
            {messages.length === 0 && !sending && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Ask a placement question, or attach a screenshot of a question, an error or a resume section.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)} className="text-left text-xs rounded-xl border border-[rgba(0,0,0,0.1)] dark:border-neutral-700 p-3 hover:border-[#C85232]">{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-[#C85232] text-white' : 'bg-[#EAE6DF] dark:bg-neutral-800 text-[#C85232]'}`}>{m.role === 'user' ? <User size={15} /> : <Bot size={15} />}</div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-[#C85232]/10' : 'bg-[#FAF8F5] dark:bg-[#0E0E10] border border-[rgba(0,0,0,0.06)] dark:border-neutral-800'}`}>
                  {m.preview && <img src={m.preview} alt="Attached" className="max-h-40 rounded-lg mb-2" />}
                  {m.hadImage && !m.preview && <p className="text-[11px] italic text-[#5E5B56] mb-1 inline-flex items-center gap-1"><ImageIcon size={12} /> image attached</p>}
                  {m.role === 'assistant' ? <FormattedMarkdown content={m.content} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                  {m.role === 'assistant' && m.sources?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[rgba(0,0,0,0.08)] dark:border-neutral-800">
                      <p className="text-[11px] font-bold uppercase text-[#5E5B56] dark:text-[#A0A0A0] mb-1">{m.fallback ? 'Closest study material (search result, not AI)' : 'Sources from PrepWise'}</p>
                      <ol className="space-y-0.5">{m.sources.map((s) => <li key={s.id} className="text-xs"><span className="font-mono">[{s.n}]</span> <Link to={s.link} className="underline text-[#C85232]">{s.title.length > 90 ? `${s.title.slice(0, 87)}...` : s.title}</Link>{s.snippet && <span className="block text-[11px] text-[#5E5B56] dark:text-[#A0A0A0] mt-0.5">{s.snippet}...</span>}</li>)}</ol>
                    </div>
                  )}
                  {m.role === 'assistant' && m.provider && <p className="text-[10px] text-[#5E5B56] dark:text-[#A0A0A0] mt-1">via {PROVIDER_LABEL[m.provider] ?? m.provider}</p>}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-[#5E5B56] inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Thinking... (if one provider is busy, the next one is tried)</p>}
            <div ref={endRef} />
          </Card>

          {note && <p role="status" className="text-xs text-[#5E5B56] dark:text-[#A0A0A0]">{note}</p>}
          {error && <p role="alert" className="text-sm text-rose-600 inline-flex items-start gap-1.5"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</p>}

          <Card padding="compact" className="space-y-2">
            {image && (
              <div className="flex items-center gap-2"><img src={image.previewUrl} alt="Selected" className="h-14 rounded-lg" /><button type="button" onClick={() => setImage(null)} aria-label="Remove image" className="text-[#5E5B56] hover:text-rose-600"><X size={16} /></button></div>
            )}
            <textarea value={text} rows={3} maxLength={4000} disabled={sending} aria-label="Your message"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
              placeholder="Type your question. Press Ctrl+Enter to send."
              className="w-full rounded-xl p-3 text-sm bg-[#FAF8F5] dark:bg-[#0E0E10] border border-[rgba(0,0,0,0.1)] dark:border-neutral-800 focus:outline-none focus:border-[#C85232]" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickImage} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} className="text-xs font-semibold text-[#C85232] inline-flex items-center gap-1"><ImageIcon size={14} /> Attach image</button>
                <label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={useSources} onChange={(e) => setUseSources(e.target.checked)} /> Use PrepWise study material as sources</label>
                <label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={shareContext} onChange={(e) => setShareContext(e.target.checked)} /> Share my target role and skill names to get tailored answers</label>
              </div>
              <Button onClick={() => send()} disabled={sending || !text.trim()}><Send size={14} /> Send</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
