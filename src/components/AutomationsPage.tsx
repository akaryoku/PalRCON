import { CalendarClock, PauseCircle, Pencil, Play, Plus, Server, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../lib';
import type { AutomationDefinition, AutomationInput, ServerProfile } from '../types';

const destructive = (command: string) => /^(?:\/+)?(?:doexit|shutdown|kickplayer|banplayer|unbanplayer)\b/i.test(command.trim());
const blank = (profileId: string): AutomationInput => ({ id: crypto.randomUUID(), profileId, name: 'Player snapshot', command: 'ShowPlayers', intervalMinutes: 15, enabled: false });

function intervalLabel(minutes: number) {
  if (minutes < 60) return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (minutes % 1440 === 0) return `Every ${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
  if (minutes % 60 === 0) return `Every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  return `Every ${minutes} minutes`;
}

function time(value?: string) { return value ? new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'; }

interface Props { profiles: ServerProfile[]; activeProfileId: string; revision: number; notify(message: string): void }

export function AutomationsPage({ profiles, activeProfileId, revision, notify }: Props) {
  const [items, setItems] = useState<AutomationDefinition[]>([]);
  const [editor, setEditor] = useState<AutomationInput | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { window.palrcon.automations.list().then(setItems).catch((reason) => setError(errorMessage(reason))); }, [revision]);

  async function save(value: AutomationInput) {
    if (value.enabled && destructive(value.command) && !confirm(`“${value.command}” can disrupt players or stop the server. Save and enable this automation?`)) return;
    try { setItems(await window.palrcon.automations.save(value)); setEditor(null); notify('Automation saved'); }
    catch (reason) { setError(errorMessage(reason)); }
  }
  async function toggle(item: AutomationDefinition) {
    if (!item.enabled && destructive(item.command) && !confirm(`Enable the destructive command “${item.command}”?`)) return;
    try { setBusyId(item.id); setItems(await window.palrcon.automations.setEnabled(item.id, !item.enabled)); }
    catch (reason) { notify(errorMessage(reason)); }
    finally { setBusyId(''); }
  }
  async function run(item: AutomationDefinition) {
    if (destructive(item.command) && !confirm(`Run “${item.command}” now?`)) return;
    try {
      setBusyId(item.id);
      const result = await window.palrcon.automations.runNow(item.id);
      notify(result.status === 'success' ? `${item.name} completed` : result.error ?? `${item.name} failed`);
    }
    catch (reason) { notify(errorMessage(reason)); }
    finally { setBusyId(''); }
  }
  async function remove(item: AutomationDefinition) {
    if (!confirm(`Delete the automation “${item.name}”?`)) return;
    try { setItems(await window.palrcon.automations.remove(item.id)); notify('Automation removed'); }
    catch (reason) { notify(errorMessage(reason)); }
  }

  return <div className="automations-page">
    <section className="automation-heading"><div><h2>Scheduled RCON commands</h2><p>Timers run only while PalRCON is open. Closed-app intervals are skipped and never replayed.</p></div><button className="button primary" onClick={() => setEditor(blank(activeProfileId || profiles[0]?.id || ''))} disabled={!profiles.length}><Plus />New automation</button></section>
    <div className="automation-notice"><PauseCircle />New automations are disabled by default. Enabling one authorizes PalRCON to send that command at the selected interval while this application is running.</div>
    {error && <div className="form-result error">{error}</div>}
    <section className="automation-list">
      {items.map((item) => { const profile = profiles.find((value) => value.id === item.profileId); return <article className={item.enabled ? 'automation-row enabled' : 'automation-row'} key={item.id}>
        <label className="automation-toggle" title={item.enabled ? 'Disable automation' : 'Enable automation'}><input type="checkbox" checked={item.enabled} disabled={busyId === item.id} onChange={() => void toggle(item)} /><span /></label>
        <div className="automation-main"><div><h3>{item.name}</h3><span className={item.enabled ? 'automation-state active' : 'automation-state'}>{item.enabled ? 'Enabled' : 'Disabled'}</span></div><code>{item.command}</code><p><Server />{profile?.name ?? 'Missing server'} <span>·</span> <CalendarClock />{intervalLabel(item.intervalMinutes)}</p></div>
        <dl className="automation-times"><div><dt>Next run</dt><dd>{item.enabled ? time(item.nextRunAt) : 'Disabled'}</dd></div><div><dt>Last run</dt><dd>{time(item.lastRunAt)}</dd></div>{item.lastMessage && <div className="automation-last"><dt>Last result</dt><dd className={item.lastStatus}>{item.lastMessage}</dd></div>}</dl>
        <div className="automation-actions"><button title="Run now" onClick={() => void run(item)} disabled={busyId === item.id}><Play /></button><button title="Edit" onClick={() => setEditor({ id: item.id, profileId: item.profileId, name: item.name, command: item.command, intervalMinutes: item.intervalMinutes, enabled: item.enabled })}><Pencil /></button><button title="Delete" className="danger-text" onClick={() => void remove(item)}><Trash2 /></button></div>
      </article>; })}
      {!items.length && <div className="automation-empty"><CalendarClock /><h3>No automations yet</h3><p>Create an interval task such as running ShowPlayers every 15 minutes.</p></div>}
    </section>
    {editor && <div className="modal-backdrop"><div className="modal automation-modal"><AutomationForm value={editor} profiles={profiles} onCancel={() => setEditor(null)} onSave={save} /></div></div>}
  </div>;
}

function AutomationForm({ value, profiles, onCancel, onSave }: { value: AutomationInput; profiles: ServerProfile[]; onCancel(): void; onSave(value: AutomationInput): void }) {
  const [draft, setDraft] = useState(value);
  const update = <K extends keyof AutomationInput>(key: K, next: AutomationInput[K]) => setDraft((current) => ({ ...current, [key]: next }));
  return <form className="profile-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
    <div className="form-title"><CalendarClock /><div><h2>{value.name ? 'Automation details' : 'New automation'}</h2><p>Recurring commands require PalRCON to remain open.</p></div></div>
    <div className="field"><label htmlFor="automation-name">Name</label><input id="automation-name" autoFocus required maxLength={100} value={draft.name} onChange={(event) => update('name', event.target.value)} /></div>
    <div className="field"><label htmlFor="automation-server">Server</label><select id="automation-server" required value={draft.profileId} onChange={(event) => update('profileId', event.target.value)}>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select></div>
    <div className="field"><label htmlFor="automation-command">RCON command</label><input id="automation-command" required maxLength={4096} value={draft.command} onChange={(event) => update('command', event.target.value)} placeholder="ShowPlayers" /><small className="field-help">A leading slash is optional. The raw response is recorded in Console.</small></div>
    <div className="form-row"><div className="field grow"><label htmlFor="automation-interval">Interval</label><select id="automation-interval" value={draft.intervalMinutes} onChange={(event) => update('intervalMinutes', Number(event.target.value))}><option value={1}>Every minute</option><option value={5}>Every 5 minutes</option><option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every hour</option><option value={360}>Every 6 hours</option><option value={720}>Every 12 hours</option><option value={1440}>Every day</option></select></div><div className="field custom-interval"><label htmlFor="automation-custom">Custom minutes</label><input id="automation-custom" type="number" min={1} max={10080} value={draft.intervalMinutes} onChange={(event) => update('intervalMinutes', Math.max(1, Math.min(10080, Number(event.target.value))))} /></div></div>
    <label className="check-row"><input type="checkbox" checked={draft.enabled} onChange={(event) => update('enabled', event.target.checked)} /><span><strong>Enable after saving</strong><small>Authorizes recurring execution while PalRCON is open.</small></span></label>
    {destructive(draft.command) && <div className="form-result warn">This command can remove players or stop the server. Enabling it requires confirmation.</div>}
    <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Save automation</button></div>
  </form>;
}
