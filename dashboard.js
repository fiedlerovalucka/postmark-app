import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const CHIP_DEFS = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Follow-up' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafted', label: 'Draft' },
  { key: 'interested', label: 'Interested' },
  { key: 'declined', label: 'Declined' },
  { key: 'won', label: 'Won' }
];
const STAMP_LABEL = { drafted: 'Draft', sent: 'Sent', overdue: 'Follow up', interested: 'Interested', declined: 'Declined', won: 'Won' };
const ORDER = { overdue: 0, sent: 1, drafted: 2, interested: 3, declined: 4, won: 5 };

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function computeStatus(p) {
  if (['won', 'declined', 'interested', 'drafted'].includes(p.status)) return p.status;
  if (p.status === 'sent') {
    const d = daysSince(p.last_contact);
    return d !== null && d >= 5 ? 'overdue' : 'sent';
  }
  return p.status || 'drafted';
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [pitches, setPitches] = useState([]);
  const [profile, setProfile] = useState({ voice: '', style_rules: '', name: '', about_me: '', portfolio_link: '' });
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [ask, setAsk] = useState('');
  const [research, setResearch] = useState(true);
  const [addDraft, setAddDraft] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [reviseText, setReviseText] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [replyOpenFor, setReplyOpenFor] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyResult, setReplyResult] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);

  const [followUpFor, setFollowUpFor] = useState(null);
  const [followUpDraft, setFollowUpDraft] = useState(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpRevise, setFollowUpRevise] = useState('');

  const loadData = useCallback(async (sess) => {
    const { data: pitchData } = await supabase
      .from('pitches')
      .select('*')
      .order('created_at', { ascending: false });
    setPitches(pitchData || []);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', sess.user.id)
      .single();
    if (profileData) setProfile(profileData);
    setLoaded(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      setSession(data.session);
      loadData(data.session);
    });
  }, [router, loadData]);

  async function authedFetch(url, body) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleDraft() {
    setAddError(null);
    if (!company.trim() || !ask.trim()) { setAddError("Add a company name and what you're asking for."); return; }
    setAddLoading(true);
    try {
      const draft = await authedFetch('/api/draft', { company: company.trim(), ask: ask.trim(), research });
      setAddDraft(draft);
    } catch (e) {
      setAddError('Could not draft the message. Try again in a moment.');
    }
    setAddLoading(false);
  }

  async function handleRevise() {
    if (!reviseText.trim()) return;
    setAddLoading(true);
    try {
      const revised = await authedFetch('/api/revise', { subject: addDraft.subject, body: addDraft.body, instruction: reviseText.trim() });
      setAddDraft(revised);
    } catch (e) {
      setAddError('Could not revise that. Try again.');
    }
    setAddLoading(false);
  }

  async function savePitch(markSent) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('pitches').insert({
      user_id: session.user.id,
      company: company.trim(),
      ask: ask.trim(),
      subject: addDraft.subject,
      body: addDraft.body,
      status: markSent ? 'sent' : 'drafted',
      last_contact: markSent ? now : null,
      history: []
    }).select().single();
    if (!error && data) setPitches([data, ...pitches]);
    setAddOpen(false); setAddDraft(null); setCompany(''); setAsk(''); setReviseText('');
  }

  async function markSent(id) {
    const now = new Date().toISOString();
    const { data } = await supabase.from('pitches').update({ status: 'sent', last_contact: now }).eq('id', id).select().single();
    if (data) setPitches(pitches.map(p => p.id === id ? data : p));
  }

  async function setManualStatus(id, status) {
    if (!status) return;
    const now = new Date().toISOString();
    const update = status === 'drafted' ? { status } : { status, last_contact: now };
    const { data } = await supabase.from('pitches').update(update).eq('id', id).select().single();
    if (data) setPitches(pitches.map(p => p.id === id ? data : p));
  }

  async function submitReplyAnalysis(pitch) {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      const result = await authedFetch('/api/analyze-reply', { company: pitch.company, ask: pitch.ask, replyText: replyText.trim() });
      setReplyResult(result);
    } catch (e) { /* keep silent, show generic below */ }
    setReplyLoading(false);
  }

  async function saveReplyUpdate(pitch) {
    const now = new Date().toISOString();
    const history = [...(pitch.history || []), { date: now, reply: replyText, draftReply: replyResult.draft_reply }];
    const { data } = await supabase.from('pitches')
      .update({ status: replyResult.suggested_status, last_contact: now, history })
      .eq('id', pitch.id).select().single();
    if (data) setPitches(pitches.map(p => p.id === pitch.id ? data : p));
    setReplyOpenFor(null); setReplyText(''); setReplyResult(null);
  }

  async function openFollowUp(pitch) {
    setFollowUpFor(pitch.id); setFollowUpDraft(null); setFollowUpLoading(true); setFollowUpRevise('');
    try {
      const draft = await authedFetch('/api/followup', { pitch, daysAgo: daysSince(pitch.last_contact) });
      setFollowUpDraft(draft);
    } catch (e) { /* silent */ }
    setFollowUpLoading(false);
  }

  async function reviseFollowUp() {
    if (!followUpRevise.trim()) return;
    setFollowUpLoading(true);
    try {
      const revised = await authedFetch('/api/revise', { subject: followUpDraft.subject, body: followUpDraft.body, instruction: followUpRevise.trim() });
      setFollowUpDraft(revised);
    } catch (e) { /* silent */ }
    setFollowUpLoading(false);
  }

  async function confirmFollowedUp(pitch) {
    const now = new Date().toISOString();
    const history = [...(pitch.history || []), { date: now, note: 'Sent follow-up', body: followUpDraft.body }];
    const { data } = await supabase.from('pitches').update({ last_contact: now, history }).eq('id', pitch.id).select().single();
    if (data) setPitches(pitches.map(p => p.id === pitch.id ? data : p));
    setFollowUpFor(null); setFollowUpDraft(null);
  }

  async function saveProfile() {
    await supabase.from('profiles').upsert({ user_id: session.user.id, ...profile });
    setSettingsOpen(false);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (!loaded) return <div className="wrap"><div className="loading" style={{ padding: '60px 0', textAlign: 'center' }}>Loading your pitches</div></div>;

  const withStatus = pitches.map(p => ({ ...p, computed: computeStatus(p) }));
  withStatus.sort((a, b) => ORDER[a.computed] - ORDER[b.computed] || new Date(b.created_at) - new Date(a.created_at));
  const counts = {};
  CHIP_DEFS.forEach(c => { counts[c.key] = c.key === 'all' ? withStatus.length : withStatus.filter(p => p.computed === c.key).length; });
  const visibleChips = CHIP_DEFS.filter(c => c.key === 'all' || counts[c.key] > 0);
  const filtered = filter === 'all' ? withStatus : withStatus.filter(p => p.computed === filter);
  const overdueCount = counts.overdue;
  const activeCount = counts.sent + counts.overdue + counts.drafted;

  return (
    <>
      <div className="airmail-strip" />
      <div className="wrap">
        <header className="top">
          <div className="brand"><h1>Postmark</h1><p>track every pitch like a package</p></div>
          <div className="row" style={{ marginTop: 0 }}>
            <button className="gear" onClick={() => setSettingsOpen(!settingsOpen)}>Your voice</button>
            <button className="btn" onClick={() => setAddOpen(!addOpen)}>{addOpen ? 'Close' : '+ New pitch'}</button>
            <button className="btn ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>

        <div className="summary">
          <div className="stat"><div className="n mono">{activeCount}</div><div className="l">active</div></div>
          <div className={`stat ${overdueCount ? 'warn' : ''}`}><div className="n mono">{overdueCount}</div><div className="l">follow-up due</div></div>
          <div className="stat"><div className="n mono">{counts.won}</div><div className="l">won</div></div>
        </div>

        <div className="chips">
          {visibleChips.map(c => (
            <button key={c.key} className={`chip ${filter === c.key ? 'active' : ''}`} onClick={() => setFilter(c.key)}>
              {c.label} <span className="chip-n">{counts[c.key]}</span>
            </button>
          ))}
        </div>

        {settingsOpen && (
          <div className="panel">
            <h2>Your voice</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -6 }}>How you like to sound. Used on every draft.</p>
            <textarea value={profile.voice} onChange={e => setProfile({ ...profile, voice: e.target.value })} placeholder="e.g. Friendly, direct, never corporate." />
            <label>Your name</label>
            <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="e.g. Lucie" />
            <label>About you</label>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -4, marginBottom: 6 }}>Postmark picks the one most relevant detail per pitch.</p>
            <textarea value={profile.about_me} onChange={e => setProfile({ ...profile, about_me: e.target.value })} placeholder="e.g. Business student building a travel and lifestyle UGC portfolio." />
            <label>Portfolio link</label>
            <input type="text" value={profile.portfolio_link} onChange={e => setProfile({ ...profile, portfolio_link: e.target.value })} placeholder="https://..." />
            <label>House style rules</label>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -4, marginBottom: 6 }}>Applied to every draft, revision, and follow-up automatically.</p>
            <textarea style={{ minHeight: 140 }} value={profile.style_rules} onChange={e => setProfile({ ...profile, style_rules: e.target.value })} />
            <div className="row">
              <button className="btn" onClick={saveProfile}>Save</button>
              <button className="btn ghost" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
          </div>
        )}

        {addOpen && (
          <div className="panel">
            <h2>New pitch</h2>
            <label>Company or organization</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Momondo" />
            <label>What are you asking for?</label>
            <textarea value={ask} onChange={e => setAsk(e.target.value)} placeholder="e.g. Free access in exchange for a UGC video and honest feedback" />
            <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={research} onChange={e => setResearch(e.target.checked)} style={{ width: 'auto' }} />
              <label style={{ margin: 0, textTransform: 'none', fontSize: 13, color: 'var(--ink)' }}>Look up this company online first</label>
            </div>
            {addError && <div className="msg-err">{addError}</div>}
            <div className="row">
              <button className="btn" disabled={addLoading} onClick={handleDraft}>{addLoading ? 'Drafting…' : 'Draft the pitch'}</button>
            </div>
            {addDraft && (
              <>
                <div className="draft-box"><div className="subj mono">{addDraft.subject}</div><div>{addDraft.body}</div></div>
                <div className="row">
                  <button className="btn small" onClick={() => copyToClipboard(addDraft.subject + '\n\n' + addDraft.body)}>Copy text</button>
                  <button className="btn small" onClick={() => savePitch(true)}>Mark as sent</button>
                  <button className="btn ghost small" onClick={() => savePitch(false)}>Save as draft only</button>
                </div>
                <label>Not quite right? Tell it what to change</label>
                <div className="row" style={{ marginTop: 0 }}>
                  <input type="text" value={reviseText} onChange={e => setReviseText(e.target.value)} placeholder="e.g. make it punchier, shorten it" style={{ flex: 1, minWidth: 200 }} />
                  <button className="btn small" disabled={addLoading} onClick={handleRevise}>{addLoading ? 'Revising…' : 'Revise'}</button>
                </div>
              </>
            )}
          </div>
        )}

        {withStatus.length === 0 && !addOpen && (
          <div className="empty"><span className="serif">No pitches yet</span>Start one above — Postmark will draft it for you.</div>
        )}
        {withStatus.length > 0 && filtered.length === 0 && (
          <div className="empty"><span className="serif">Nothing here</span>No pitches match this filter right now.</div>
        )}

        {filtered.map(p => {
          const d = daysSince(p.last_contact);
          const metaLine = p.status === 'drafted'
            ? `Drafted ${fmtDate(p.created_at)} — not sent yet`
            : `Last contact ${fmtDate(p.last_contact)} · ${d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} ago`}`;
          const expanded = expandedId === p.id;

          return (
            <div key={p.id} className={`card ${p.computed}`}>
              <div className="card-top" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : p.id)}>
                <div>
                  <div className="co"><span className="caret">{expanded ? '▾' : '▸'}</span> {p.company}</div>
                  <div className="ask">{p.ask}</div>
                </div>
                <div className={`stamp st-${p.computed}`}>{STAMP_LABEL[p.computed]}</div>
              </div>
              <div className="meta">{metaLine}</div>

              {expanded && (
                <>
                  <div className="draft-box" style={{ marginTop: 12 }}>
                    <div className="subj mono">{p.subject}</div><div>{p.body}</div>
                  </div>
                  {p.history && p.history.length > 0 && (
                    <div className="timeline">
                      {p.history.map((h, i) => h.note ? (
                        <div className="tl-entry" key={i}>
                          <div className="tl-date mono">{fmtDate(h.date)} · {h.note}</div>
                          <div className="tl-text">{h.body || ''}</div>
                        </div>
                      ) : (
                        <div className="tl-entry" key={i}>
                          <div className="tl-date mono">{fmtDate(h.date)} · Their reply</div>
                          <div className="tl-text">{h.reply}</div>
                          <div className="tl-date mono" style={{ marginTop: 6 }}>Your suggested reply</div>
                          <div className="tl-text">{h.draftReply}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="card-actions">
                {p.status === 'drafted' && (
                  <>
                    <button className="btn small" onClick={() => markSent(p.id)}>Mark as sent</button>
                    <button className="btn ghost small" onClick={() => copyToClipboard(p.subject + '\n\n' + p.body)}>Copy draft</button>
                  </>
                )}
                {['sent', 'overdue', 'interested'].includes(p.computed) && (
                  <button className="btn small" onClick={() => { setReplyOpenFor(p.id); setReplyText(''); setReplyResult(null); }}>Log a reply</button>
                )}
                {p.computed === 'overdue' && (
                  <button className="btn ghost small" onClick={() => openFollowUp(p)}>Draft follow-up</button>
                )}
                <select value="" onChange={e => setManualStatus(p.id, e.target.value)}>
                  <option value="">Change status…</option>
                  <option value="drafted">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="interested">Interested</option>
                  <option value="declined">Declined</option>
                  <option value="won">Won</option>
                </select>
              </div>

              {replyOpenFor === p.id && (
                <div className="panel" style={{ marginTop: 12, padding: 14 }}>
                  <label>Paste their reply</label>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} />
                  <div className="row">
                    <button className="btn small" disabled={replyLoading} onClick={() => submitReplyAnalysis(p)}>{replyLoading ? 'Reading…' : 'Analyze reply'}</button>
                    <button className="btn ghost small" onClick={() => { setReplyOpenFor(null); setReplyText(''); setReplyResult(null); }}>Cancel</button>
                  </div>
                  {replyResult && (
                    <>
                      <div className="draft-box"><div className="subj mono">Reads as: {replyResult.sentiment}</div><div>{replyResult.draft_reply}</div></div>
                      <div className="row">
                        <button className="btn small" onClick={() => copyToClipboard(replyResult.draft_reply)}>Copy reply</button>
                        <button className="btn small" onClick={() => saveReplyUpdate(p)}>Save & update status</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {followUpFor === p.id && (
                <div className="panel" style={{ marginTop: 12, padding: 14 }}>
                  {followUpLoading && <div className="loading">Drafting follow-up</div>}
                  {followUpDraft && (
                    <>
                      <div className="draft-box"><div className="subj mono">{followUpDraft.subject}</div><div>{followUpDraft.body}</div></div>
                      <div className="row">
                        <button className="btn small" onClick={() => copyToClipboard(followUpDraft.subject + '\n\n' + followUpDraft.body)}>Copy text</button>
                        <button className="btn small" onClick={() => confirmFollowedUp(p)}>Mark as followed up</button>
                        <button className="btn ghost small" onClick={() => { setFollowUpFor(null); setFollowUpDraft(null); }}>Cancel</button>
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <input type="text" value={followUpRevise} onChange={e => setFollowUpRevise(e.target.value)} placeholder="e.g. make it shorter" style={{ flex: 1, minWidth: 180 }} />
                        <button className="btn small" disabled={followUpLoading} onClick={reviseFollowUp}>{followUpLoading ? 'Revising…' : 'Revise'}</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
