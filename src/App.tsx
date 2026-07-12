import {
  Activity, Ban, CalendarClock, ChevronDown, CircleGauge, Clock3, Command, Database, Download,
  ExternalLink, LayoutDashboard, Megaphone, Pencil, RefreshCw, Save, Server,
  Settings, ShieldBan, SquareTerminal, Stethoscope, Trash2, Unplug, Upload,
  Users, Wifi, WifiOff
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsolePage } from './components/ConsolePage';
import { AutomationsPage } from './components/AutomationsPage';
import { DiagnosticsPage } from './components/DiagnosticsPage';
import { Logo } from './components/Logo';
import { ProfileForm } from './components/ProfileForm';
import { errorMessage, formatUptime, formatValue, parseRconInfo, parseRconPlayers, rconCommandName } from './lib';
import type { AutomationResult, ConsoleLogEntry, DashboardData, Player, Preferences, ServerProfile, UpdateResult } from './types';

type Page = 'overview' | 'players' | 'console' | 'automations' | 'diagnostics' | 'settings';

export default function App() {
  const [profiles, setProfiles] = useState<ServerProfile[]>([]);
  const [activeId, setActiveId] = useState('');
  const [page, setPage] = useState<Page>('overview');
  const [data, setData] = useState<DashboardData>();
  const [rconSnapshots, setRconSnapshots] = useState<Record<string, { players?: Player[]; info?: Record<string, unknown> }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileEditor, setProfileEditor] = useState<'new' | 'edit' | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [preferences, setPreferences] = useState<Preferences>({ checkForUpdatesOnStartup: false });
  const [update, setUpdate] = useState<UpdateResult>();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [automationRevision, setAutomationRevision] = useState(0);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([{ id: crypto.randomUUID(), time: new Date(), kind: 'system', text: 'PalRCON ready. Select a server to begin.' }]);
  const refreshInFlight = useRef(false);
  const active = profiles.find((profile) => profile.id === activeId);
  const snapshot = rconSnapshots[activeId];
  const players = useMemo(() => data?.players ?? snapshot?.players ?? [], [data, snapshot]);
  const effectiveData = useMemo<DashboardData | undefined>(() => data ?? (snapshot ? {
    source: 'rcon', info: snapshot.info ?? {}, players: snapshot.players ?? [], metrics: {}, settings: {}, refreshedAt: Date.now()
  } : undefined), [data, snapshot]);

  const addLog = useCallback((kind: ConsoleLogEntry['kind'], text: string) => {
    setLogs((current) => [...current.slice(-499), { id: crypto.randomUUID(), time: new Date(), kind, text }]);
  }, []);

  const refresh = useCallback(async () => {
    if (!activeId || refreshInFlight.current) return;
    refreshInFlight.current = true; setRefreshing(true);
    try { setData(await window.palrcon.server.dashboard(activeId)); setError(''); }
    catch (reason) { setError(errorMessage(reason)); addLog('error', errorMessage(reason)); }
    finally { refreshInFlight.current = false; setLoading(false); setRefreshing(false); }
  }, [activeId, addLog]);

  const applyCommandResponse = useCallback((profileId: string, command: string, response: string, notify = true) => {
    const name = rconCommandName(command);
    if (name === 'showplayers') {
      const parsed = parseRconPlayers(response);
      setRconSnapshots((current) => ({ ...current, [profileId]: { ...current[profileId], players: parsed } }));
      if (notify) setToast(`${parsed.length} player${parsed.length === 1 ? '' : 's'} loaded from RCON`);
    } else if (name === 'info') {
      setRconSnapshots((current) => ({ ...current, [profileId]: { ...current[profileId], info: parseRconInfo(response) } }));
      if (notify) setToast('Server details loaded from RCON');
    }
  }, []);

  useEffect(() => {
    window.palrcon.profiles.list().then((items) => {
      setProfiles(items); if (items[0]) setActiveId(items[0].id); else setProfileEditor('new');
    }).catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false));
    window.palrcon.preferences.get().then((value) => {
      setPreferences(value); if (value.checkForUpdatesOnStartup) void checkUpdates(false);
    }).catch(() => undefined);
  }, []);
  useEffect(() => { setData(undefined); setError(''); }, [activeId]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3_200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => window.palrcon.automations.onResult((result: AutomationResult) => {
    addLog('command', `[Automation: ${result.name}] > ${result.command}`);
    if (result.status === 'success') {
      const response = result.response || 'Command completed successfully.';
      addLog('success', response); applyCommandResponse(result.profileId, result.command, result.response ?? '', result.profileId === activeId);
    } else addLog('error', `[Automation: ${result.name}] ${result.error ?? 'Command failed.'}`);
    setAutomationRevision((value) => value + 1);
  }), [activeId, addLog, applyCommandResponse]);

  async function saveProfile(profile: ServerProfile) {
    const next = await window.palrcon.profiles.save(profile);
    setProfiles(next); setActiveId(profile.id); setProfileEditor(null); setToast('Server profile saved');
  }
  async function removeProfile() {
    if (!active || !confirm(`Remove “${active.name}” from PalRCON?`)) return;
    const next = await window.palrcon.profiles.remove(active.id);
    setProfiles(next); setActiveId(next[0]?.id ?? ''); if (!next.length) setProfileEditor('new');
  }
  async function importProfiles() {
    try {
      const result = await window.palrcon.profiles.import();
      if (!result.canceled) {
        setProfiles(result.profiles);
        const firstImported = result.profiles[result.profiles.length - result.count];
        if (firstImported) setActiveId(firstImported.id);
        setToast(`${result.count} profile${result.count === 1 ? '' : 's'} imported; enter passwords before connecting`);
      }
    } catch (reason) { setToast(errorMessage(reason)); }
  }
  async function exportProfiles() {
    try { const result = await window.palrcon.profiles.export(); if (!result.canceled) setToast(`${result.count} profile${result.count === 1 ? '' : 's'} exported without passwords`); }
    catch (reason) { setToast(errorMessage(reason)); }
  }
  async function action(actionName: string, payload?: Record<string, unknown>, success = 'Action completed') {
    if (!activeId) return;
    try { await window.palrcon.server.action(activeId, actionName, payload); setToast(success); addLog('success', success); }
    catch (reason) { setToast(errorMessage(reason)); addLog('error', errorMessage(reason)); }
  }
  async function setUpdatePreference(enabled: boolean) {
    try { setPreferences(await window.palrcon.preferences.set({ checkForUpdatesOnStartup: enabled })); }
    catch (reason) { setToast(errorMessage(reason)); }
  }
  async function checkUpdates(notify = true) {
    setCheckingUpdates(true);
    try {
      const result = await window.palrcon.updates.check(); setUpdate(result);
      if (notify) setToast(result.updateAvailable ? `PalRCON ${result.latestVersion} is available` : `PalRCON ${result.currentVersion} is current`);
    } catch (reason) { if (notify) setToast(errorMessage(reason)); }
    finally { setCheckingUpdates(false); }
  }
  if (profileEditor === 'new' && !profiles.length) return <div className="onboarding"><div className="onboarding-brand"><Logo /><p>Local administration for Palworld dedicated servers.</p></div><ProfileForm onSave={saveProfile} /></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <div className="server-picker"><label htmlFor="active-server">Server</label><div className="select-wrap"><Server size={15} /><select id="active-server" value={activeId} onChange={(event) => setActiveId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><ChevronDown size={14} /></div></div>
      <nav aria-label="Primary navigation">
        <button className={page === 'overview' ? 'active' : ''} onClick={() => setPage('overview')}><LayoutDashboard />Overview</button>
        <button className={page === 'players' ? 'active' : ''} onClick={() => setPage('players')}><Users />Players{players.length > 0 && <span>{players.length}</span>}</button>
        <button className={page === 'console' ? 'active' : ''} onClick={() => setPage('console')}><SquareTerminal />Console</button>
        <button className={page === 'automations' ? 'active' : ''} onClick={() => setPage('automations')}><CalendarClock />Automations</button>
        <button className={page === 'diagnostics' ? 'active' : ''} onClick={() => setPage('diagnostics')}><Stethoscope />Diagnostics</button>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Settings />Settings</button>
      </nav>
      <div className="sidebar-status">{error ? <><WifiOff /><div><strong>Unavailable</strong><span>{active?.host ?? 'No server'}</span></div></> : <><Wifi /><div><strong>{data ? 'REST data loaded' : 'Ready'}</strong><span>{active?.host ?? 'No server'}</span></div></>}</div>
    </aside>
    <main>
      <header className="topbar"><div><h1>{page[0].toUpperCase() + page.slice(1)}</h1><p>{active?.name ?? 'No server selected'} <span className="separator">/</span> {effectiveData?.source?.toUpperCase() ?? (active?.restEnabled ? 'REST' : 'RCON manual')}</p></div><div className="topbar-actions"><button className="button secondary" onClick={() => void refresh()} disabled={refreshing || !activeId || !active?.restEnabled || page === 'console' || page === 'automations' || page === 'diagnostics'} title={!active?.restEnabled ? 'Enable REST API to load dashboard data' : 'Load current REST API data'}><RefreshCw className={refreshing ? 'spin' : ''} />{refreshing ? 'Loading' : 'Load REST data'}</button></div></header>
      <div className={page === 'console' ? 'content console-content' : 'content'}>
        {error && page === 'overview' && <ConnectionError message={error} onRetry={() => void refresh()} onEdit={() => setProfileEditor('edit')} />}
        {!error && loading && <LoadingState />}
        {!error && !loading && page === 'overview' && <Overview data={effectiveData} players={players} restEnabled={active?.restEnabled ?? false} onAction={action} />}
        {page === 'players' && <PlayersPage players={players} source={effectiveData?.source} onAction={action} />}
        {page === 'console' && <ConsolePage activeId={activeId} logs={logs} addLog={addLog} clearLogs={() => setLogs([{ id: crypto.randomUUID(), time: new Date(), kind: 'system', text: 'Console cleared.' }])} onResponse={(command, response) => applyCommandResponse(activeId, command, response)} notify={setToast} />}
        {page === 'automations' && <AutomationsPage profiles={profiles} activeProfileId={activeId} revision={automationRevision} notify={setToast} />}
        {page === 'diagnostics' && active && <DiagnosticsPage profile={active} notify={setToast} />}
        {page === 'settings' && active && <SettingsPage profile={active} data={data} preferences={preferences} update={update} checkingUpdates={checkingUpdates} onEdit={() => setProfileEditor('edit')} onAdd={() => setProfileEditor('new')} onRemove={removeProfile} onImport={importProfiles} onExport={exportProfiles} onSetUpdatePreference={setUpdatePreference} onCheckUpdates={() => checkUpdates(true)} />}
      </div>
    </main>
    {profileEditor && <div className="modal-backdrop"><div className="modal"><ProfileForm initial={profileEditor === 'edit' ? active : undefined} onCancel={() => setProfileEditor(null)} onSave={saveProfile} /></div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function LoadingState() { return <div className="loading-state"><RefreshCw className="spin" /><span>Loading…</span></div>; }
function ConnectionError({ message, onRetry, onEdit }: { message: string; onRetry(): void; onEdit(): void }) { return <div className="connection-error"><Unplug /><h2>Couldn’t reach this server</h2><p>{message}</p><div><button className="button primary" onClick={onRetry}>Try again</button><button className="button secondary" onClick={onEdit}>Check connection details</button></div></div>; }

function Overview({ data, players, restEnabled, onAction }: { data?: DashboardData; players: Player[]; restEnabled: boolean; onAction(a: string, p?: Record<string, unknown>, s?: string): void }) {
  const metrics = data?.metrics ?? {}; const info = data?.info ?? {}; const settings = data?.settings ?? {}; const [message, setMessage] = useState('');
  return <div className="overview-grid">
    {!restEnabled && !data && <div className="warning-banner">RCON runs only from Console or automations you explicitly enable. Run Info or ShowPlayers to populate structured views.</div>}
    {restEnabled && !data && <div className="info-banner">No background requests are made. Select “Load REST data” to refresh.</div>}
    <section className="server-summary"><div className="server-title"><div><h2>{formatValue(info.servername ?? settings.ServerName ?? 'Palworld server')}</h2><p>{formatValue(info.description ?? settings.ServerDescription ?? info.raw ?? 'Server has not been queried')}</p></div><span className={data ? 'online-mark' : 'idle-mark'}>{data ? `${data.source.toUpperCase()} snapshot` : 'Not queried'}</span></div><div className="metric-strip"><Metric icon={<Users />} label="Players" value={`${formatValue(metrics.currentplayernum ?? players.length)} / ${formatValue(metrics.maxplayernum ?? settings.ServerPlayerMaxNum)}`} /><Metric icon={<CircleGauge />} label="Server FPS" value={formatValue(metrics.serverfps)} /><Metric icon={<Clock3 />} label="Uptime" value={formatUptime(metrics.uptime)} /><Metric icon={<Activity />} label="Frame time" value={metrics.serverframetime ? `${Number(metrics.serverframetime).toFixed(1)} ms` : '—'} /></div></section>
    <section className="panel player-preview"><div className="panel-header"><div><h2>Online players</h2><p>{players.length ? `${players.length} in the latest snapshot` : 'No players in the latest snapshot'}</p></div><Users /></div><PlayerRows players={players.slice(0, 5)} /></section>
    {restEnabled ? <section className="panel quick-actions"><div className="panel-header"><div><h2>REST actions</h2><p>Operations through the REST API</p></div><Command /></div><div className="broadcast-row"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Announcement to all players" /><button className="button primary" disabled={!message.trim()} onClick={() => { onAction('announce', { message }, 'Announcement sent'); setMessage(''); }}><Megaphone />Send</button></div><div className="action-list"><button onClick={() => onAction('save', undefined, 'World saved')}><Save /><span><strong>Save world</strong><small>Write current world state to disk</small></span></button><button className="danger-text" onClick={() => { if (confirm('Force-stop the server now?')) onAction('stop', undefined, 'Server stop requested'); }}><ShieldBan /><span><strong>Force stop</strong><small>Immediately end the process</small></span></button></div></section> : <section className="panel manual-rcon"><div className="panel-header"><div><h2>RCON controls</h2><p>Manual unless you explicitly enable an automation</p></div><SquareTerminal /></div><div><p>Run commands in Console or create an Automation. Info and ShowPlayers responses are parsed into these views.</p></div></section>}
    <section className="panel server-details"><div className="panel-header"><div><h2>Server details</h2><p>Latest {data?.source?.toUpperCase() ?? 'manual'} snapshot</p></div><Database /></div><dl><Detail label="Version" value={info.version} /><Detail label="World GUID" value={info.worldguid} /><Detail label="Game days" value={metrics.days} /><Detail label="Base camps" value={metrics.basecampnum} /><Detail label="Region" value={settings.Region} /><Detail label="Platform" value={settings.AllowConnectPlatform} /></dl></section>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function Detail({ label, value }: { label: string; value: unknown }) { return <div><dt>{label}</dt><dd title={formatValue(value)}>{formatValue(value)}</dd></div>; }
function PlayerRows({ players }: { players: Player[] }) { return players.length ? <div className="player-rows">{players.map((player) => <div key={player.userId || player.playerId}><div className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</div><span><strong>{player.name}</strong><small>{player.accountName || player.userId || player.playerId}</small></span>{player.ping !== undefined && <em>{Math.round(player.ping)} ms</em>}</div>)}</div> : <div className="empty-list">No active players</div>; }

function PlayersPage({ players, source, onAction }: { players: Player[]; source?: string; onAction(a: string, p?: Record<string, unknown>, s?: string): void }) {
  const [query, setQuery] = useState(''); const filtered = players.filter((player) => `${player.name} ${player.userId} ${player.accountName ?? ''}`.toLowerCase().includes(query.toLowerCase())); const canModerate = source === 'rest';
  return <section className="panel players-panel"><div className="table-tools"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search players" /><span>{players.length} online · {source?.toUpperCase() ?? 'NO SNAPSHOT'}</span></div><div className="player-table"><div className="table-head"><span>Player</span><span>Level</span><span>Ping</span><span>Player / user ID</span><span></span></div>{filtered.map((player) => <div className="table-row" key={player.userId || player.playerId}><span className="player-cell"><i>{player.name.slice(0, 1).toUpperCase()}</i><span><strong>{player.name}</strong><small>{player.accountName}</small></span></span><span>{formatValue(player.level)}</span><span>{player.ping === undefined ? '—' : `${Math.round(player.ping)} ms`}</span><span className="mono">{player.userId || player.playerId}</span><span className="row-actions">{canModerate && <><button title="Kick player" onClick={() => { if (confirm(`Kick ${player.name}?`)) onAction('kick', { userId: player.userId || player.playerId }, `${player.name} was kicked`); }}><Unplug /></button><button title="Ban player" className="danger-text" onClick={() => { if (confirm(`Ban ${player.name}?`)) onAction('ban', { userId: player.userId || player.playerId }, `${player.name} was banned`); }}><Ban /></button></>}</span></div>)}</div>{!filtered.length && <div className="empty-list">{players.length ? 'No players match your search' : 'Run ShowPlayers in Console or load REST data.'}</div>}</section>;
}

interface SettingsProps {
  profile: ServerProfile; data?: DashboardData; preferences: Preferences; update?: UpdateResult; checkingUpdates: boolean;
  onEdit(): void; onAdd(): void; onRemove(): void; onImport(): void; onExport(): void;
  onSetUpdatePreference(value: boolean): void; onCheckUpdates(): void;
}
function SettingsPage({ profile, data, preferences, update, checkingUpdates, onEdit, onAdd, onRemove, onImport, onExport, onSetUpdatePreference, onCheckUpdates }: SettingsProps) {
  const settings = data?.settings ?? {};
  return <div className="settings-layout expanded">
    <section className="panel"><div className="panel-header"><div><h2>Connection</h2><p>Stored locally with an encrypted password</p></div><button className="button secondary" onClick={onEdit}><Pencil />Edit</button></div>{profile.credentialError && <div className="credential-warning">Password recovery required. Edit this profile and save the password again.</div>}<dl className="connection-list"><Detail label="Server name" value={profile.name} /><Detail label="Address" value={profile.host} /><Detail label="RCON port" value={profile.rconPort} /><Detail label="REST API" value={profile.restEnabled ? `Enabled · ${profile.restPort}` : 'Disabled'} /></dl><div className="settings-actions"><button className="button secondary" onClick={onAdd}><Server />Add server</button><button className="button danger" onClick={onRemove}><Trash2 />Remove</button></div></section>
    <section className="panel"><div className="panel-header"><div><h2>Profile portability</h2><p>JSON exports never include passwords</p></div></div><div className="profile-tools"><button className="button secondary" onClick={onImport}><Upload />Import profiles</button><button className="button secondary" onClick={onExport}><Download />Export profiles</button><p>Imported profiles preserve addresses and ports. Enter each password locally before connecting.</p></div></section>
    <section className="panel update-panel"><div className="panel-header"><div><h2>Application updates</h2><p>Checks official releases from akaryoku/PalRCON</p></div><button className="button secondary" onClick={onCheckUpdates} disabled={checkingUpdates}><RefreshCw className={checkingUpdates ? 'spin' : ''} />{checkingUpdates ? 'Checking' : 'Check now'}</button></div><label className="check-row update-optin"><input type="checkbox" checked={preferences.checkForUpdatesOnStartup} onChange={(event) => onSetUpdatePreference(event.target.checked)} /><span><strong>Check at startup</strong><small>Opt in to one GitHub request when PalRCON starts. No update is downloaded automatically.</small></span></label>{update && <div className={update.updateAvailable ? 'update-result available' : 'update-result'}><div><strong>{update.updateAvailable ? `Version ${update.latestVersion} is available` : `Version ${update.currentVersion} is current`}</strong><span>Latest GitHub release: {update.releaseName}</span></div>{update.updateAvailable && <button className="button primary" onClick={() => void window.palrcon.updates.open()}><ExternalLink />Open release</button>}</div>}</section>
    <section className="panel settings-values"><div className="panel-header"><div><h2>Game settings</h2><p>Read-only values reported by REST</p></div></div>{Object.keys(settings).length ? <dl>{Object.entries(settings).map(([key, value]) => <Detail key={key} label={key} value={value} />)}</dl> : <div className="empty-list">Load REST data to view settings.</div>}</section>
  </div>;
}
