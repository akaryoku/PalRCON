import {
  Activity, Ban, ChevronDown, CircleGauge, Clock3, Command, Database,
  LayoutDashboard, Megaphone, Pencil, Play, RefreshCw, Save, Server,
  Settings, ShieldBan, SquareTerminal, Trash2, Unplug, Users, Wifi, WifiOff
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from './components/Logo';
import { ProfileForm } from './components/ProfileForm';
import { errorMessage, formatUptime, formatValue, parseRconPlayers } from './lib';
import type { DashboardData, Player, ServerProfile } from './types';

type Page = 'overview' | 'players' | 'console' | 'settings';
type LogEntry = { id: string; time: Date; kind: 'command' | 'success' | 'error' | 'system'; text: string };

const commands = [
  { label: 'Server info', value: 'Info' }, { label: 'Show players', value: 'ShowPlayers' },
  { label: 'Save world', value: 'Save' }, { label: 'Broadcast…', value: 'Broadcast ' },
  { label: 'Kick player…', value: 'KickPlayer ' }, { label: 'Ban player…', value: 'BanPlayer ' },
  { label: 'Unban player…', value: 'UnBanPlayer ' }, { label: 'Shutdown…', value: 'Shutdown 60 ' }
];

export default function App() {
  const [profiles, setProfiles] = useState<ServerProfile[]>([]);
  const [activeId, setActiveId] = useState('');
  const [page, setPage] = useState<Page>('overview');
  const [data, setData] = useState<DashboardData>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileEditor, setProfileEditor] = useState<'new' | 'edit' | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([{ id: crypto.randomUUID(), time: new Date(), kind: 'system', text: 'PalRCON ready. Select a server to begin.' }]);
  const refreshInFlight = useRef(false);
  const hasDashboardData = useRef(false);
  const active = profiles.find((profile) => profile.id === activeId);
  const players = useMemo(() => data?.players ?? parseRconPlayers(data?.playersRaw), [data]);

  const addLog = useCallback((kind: LogEntry['kind'], text: string) => {
    setLogs((current) => [...current.slice(-199), { id: crypto.randomUUID(), time: new Date(), kind, text }]);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!activeId || refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) setRefreshing(true);
    try {
      const next = await window.palrcon.server.dashboard(activeId);
      setData(next); hasDashboardData.current = true; setError('');
      if (next.warning && !silent) addLog('error', `REST unavailable; using RCON fallback. ${next.warning}`);
    } catch (reason) {
      if (!hasDashboardData.current) setError(errorMessage(reason));
      addLog('error', errorMessage(reason));
      if (silent && hasDashboardData.current) setToast(`Auto refresh stopped: ${errorMessage(reason)}`);
    } finally { refreshInFlight.current = false; setLoading(false); setRefreshing(false); }
  }, [activeId, addLog]);

  useEffect(() => {
    window.palrcon.profiles.list().then((items) => {
      setProfiles(items);
      if (items[0]) setActiveId(items[0].id); else setProfileEditor('new');
    }).catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (activeId) { hasDashboardData.current = false; setLoading(false); setError(''); setData(undefined); } }, [activeId]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer); }, [toast]);

  async function saveProfile(profile: ServerProfile) {
    const next = await window.palrcon.profiles.save(profile);
    setProfiles(next); setActiveId(profile.id); setProfileEditor(null); setToast('Server profile saved');
  }
  async function removeProfile() {
    if (!active || !confirm(`Remove “${active.name}” from PalRCON?`)) return;
    const next = await window.palrcon.profiles.remove(active.id);
    setProfiles(next); setActiveId(next[0]?.id ?? ''); setData(undefined);
    if (!next.length) setProfileEditor('new');
  }
  async function action(actionName: string, payload?: Record<string, unknown>, success = 'Command completed') {
    if (!activeId) return;
    try {
      await window.palrcon.server.action(activeId, actionName, payload);
      setToast(success); addLog('success', success); void refresh(true);
    } catch (reason) { setToast(errorMessage(reason)); addLog('error', errorMessage(reason)); }
  }

  if (profileEditor === 'new' && !profiles.length) {
    return <div className="onboarding"><div className="onboarding-brand"><Logo /><p>Local administration for Palworld dedicated servers.</p></div><ProfileForm onSave={saveProfile} /></div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="server-picker">
          <label htmlFor="active-server">Server</label>
          <div className="select-wrap"><Server size={15} /><select id="active-server" value={activeId} onChange={(event) => setActiveId(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><ChevronDown size={14} /></div>
        </div>
        <nav aria-label="Primary navigation">
          <button className={page === 'overview' ? 'active' : ''} onClick={() => setPage('overview')}><LayoutDashboard />Overview</button>
          <button className={page === 'players' ? 'active' : ''} onClick={() => setPage('players')}><Users />Players{players.length > 0 && <span>{players.length}</span>}</button>
          <button className={page === 'console' ? 'active' : ''} onClick={() => setPage('console')}><SquareTerminal />Console</button>
          <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Settings />Settings</button>
        </nav>
        <div className="sidebar-status">
          {error ? <><WifiOff size={16} /><div><strong>Unavailable</strong><span>{active?.host ?? 'No server'}</span></div></> : <><Wifi size={16} /><div><strong>{data ? 'REST data loaded' : 'Ready'}</strong><span>{active?.host ?? 'No server'}</span></div></>}
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div><h1>{page[0].toUpperCase() + page.slice(1)}</h1><p>{active?.name ?? 'No server selected'} <span className="separator">/</span> {data?.source?.toUpperCase() ?? (active?.restEnabled ? 'REST' : 'RCON manual')}</p></div>
          <div className="topbar-actions">
            <button className="button secondary" onClick={() => void refresh()} disabled={refreshing || !activeId || !active?.restEnabled || page === 'console'} title={!active?.restEnabled ? 'Enable REST API to load dashboard data' : 'Load current REST API data'}><RefreshCw size={15} className={refreshing ? 'spin' : ''} />{refreshing ? 'Loading' : 'Load REST data'}</button>
          </div>
        </header>
        <div className="content">
          {error && <ConnectionError message={error} onRetry={() => void refresh()} onEdit={() => setProfileEditor('edit')} />}
          {!error && loading && <LoadingState />}
          {!error && !loading && page === 'overview' && <Overview data={data} players={players} restEnabled={active?.restEnabled ?? false} onAction={action} />}
          {!error && !loading && page === 'players' && <PlayersPage players={players} source={data?.source} onAction={action} />}
          {!error && page === 'console' && <ConsolePage activeId={activeId} logs={logs} addLog={addLog} />}
          {!error && page === 'settings' && active && <SettingsPage profile={active} data={data} onEdit={() => setProfileEditor('edit')} onAdd={() => setProfileEditor('new')} onRemove={removeProfile} />}
        </div>
      </main>
      {profileEditor && <div className="modal-backdrop"><div className="modal"><ProfileForm initial={profileEditor === 'edit' ? active : undefined} onCancel={() => setProfileEditor(null)} onSave={saveProfile} /></div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function LoadingState() { return <div className="loading-state"><RefreshCw className="spin" /><span>Contacting server…</span></div>; }

function ConnectionError({ message, onRetry, onEdit }: { message: string; onRetry(): void; onEdit(): void }) {
  return <div className="connection-error"><Unplug size={30} /><h2>Couldn’t reach this server</h2><p>{message}</p><div><button className="button primary" onClick={onRetry}>Try again</button><button className="button secondary" onClick={onEdit}>Check connection details</button></div></div>;
}

function Overview({ data, players, restEnabled, onAction }: { data?: DashboardData; players: Player[]; restEnabled: boolean; onAction(a: string, p?: Record<string, unknown>, s?: string): void }) {
  const metrics = data?.metrics ?? {}; const info = data?.info ?? {}; const settings = data?.settings ?? {};
  const [message, setMessage] = useState('');
  return <div className="overview-grid">
    {!restEnabled && <div className="warning-banner">RCON is manual-only. Use Console to enter commands, or enable REST API to load dashboard and player data.</div>}
    {restEnabled && !data && <div className="info-banner">No background requests are made. Select “Load REST data” when you want to refresh the dashboard.</div>}
    {data?.warning && <div className="warning-banner">REST API is unavailable. Live data is limited to RCON responses.</div>}
    <section className="server-summary">
      <div className="server-title"><div><h2>{formatValue(info.servername ?? settings.ServerName ?? 'Palworld server')}</h2><p>{formatValue(info.description ?? settings.ServerDescription ?? 'Server has not been queried')}</p></div><span className={data ? 'online-mark' : 'idle-mark'}>{data ? 'Online' : 'Not queried'}</span></div>
      <div className="metric-strip">
        <Metric icon={<Users />} label="Players" value={`${formatValue(metrics.currentplayernum ?? players.length)} / ${formatValue(metrics.maxplayernum ?? settings.ServerPlayerMaxNum)}`} />
        <Metric icon={<CircleGauge />} label="Server FPS" value={formatValue(metrics.serverfps)} />
        <Metric icon={<Clock3 />} label="Uptime" value={formatUptime(metrics.uptime)} />
        <Metric icon={<Activity />} label="Frame time" value={metrics.serverframetime ? `${Number(metrics.serverframetime).toFixed(1)} ms` : '—'} />
      </div>
    </section>
    <section className="panel player-preview"><div className="panel-header"><div><h2>Online players</h2><p>{players.length ? `${players.length} currently connected` : 'Nobody is connected'}</p></div><Users size={19} /></div><PlayerRows players={players.slice(0, 5)} /></section>
    {restEnabled ? <section className="panel quick-actions"><div className="panel-header"><div><h2>REST actions</h2><p>Administrative operations through the REST API</p></div><Command size={19} /></div>
      <div className="broadcast-row"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement to all players" onKeyDown={(e) => { if (e.key === 'Enter' && message.trim()) { onAction('announce', { message }, 'Announcement sent'); setMessage(''); } }} /><button className="button primary" disabled={!message.trim()} onClick={() => { onAction('announce', { message }, 'Announcement sent'); setMessage(''); }}><Megaphone size={15} />Send</button></div>
      <div className="action-list"><button onClick={() => onAction('save', undefined, 'World saved')}><Save /><span><strong>Save world</strong><small>Write current world state to disk</small></span></button><button className="danger-text" onClick={() => { if (confirm('Force-stop the server now? Unsaved progress may be lost.')) onAction('stop', undefined, 'Server stop requested'); }}><ShieldBan /><span><strong>Force stop</strong><small>Immediately end the server process</small></span></button></div>
    </section> : <section className="panel manual-rcon"><div className="panel-header"><div><h2>Manual RCON</h2><p>Commands are never sent in the background</p></div><SquareTerminal size={19} /></div><div><p>Open Console, enter a command, and select Run. Its response will appear directly in the console history.</p></div></section>}
    <section className="panel server-details"><div className="panel-header"><div><h2>Server details</h2><p>Reported by {data?.source === 'rest' ? 'REST API' : 'RCON'}</p></div><Database size={19} /></div><dl><Detail label="Version" value={info.version} /><Detail label="World GUID" value={info.worldguid} /><Detail label="Game days" value={metrics.days} /><Detail label="Base camps" value={metrics.basecampnum} /><Detail label="Region" value={settings.Region} /><Detail label="Platform" value={settings.AllowConnectPlatform} /></dl></section>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function Detail({ label, value }: { label: string; value: unknown }) { return <div><dt>{label}</dt><dd title={formatValue(value)}>{formatValue(value)}</dd></div>; }

function PlayerRows({ players }: { players: Player[] }) {
  if (!players.length) return <div className="empty-list">No active players</div>;
  return <div className="player-rows">{players.map((player) => <div key={player.userId || player.playerId}><div className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</div><span><strong>{player.name}</strong><small>{player.accountName || player.userId || player.playerId}</small></span>{player.ping !== undefined && <em>{Math.round(player.ping)} ms</em>}</div>)}</div>;
}

function PlayersPage({ players, source, onAction }: { players: Player[]; source?: string; onAction(a: string, p?: Record<string, unknown>, s?: string): void }) {
  const [query, setQuery] = useState('');
  const filtered = players.filter((player) => `${player.name} ${player.userId} ${player.accountName ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel players-panel"><div className="table-tools"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" /><span>{players.length} online · {source?.toUpperCase()}</span></div>
    <div className="player-table"><div className="table-head"><span>Player</span><span>Level</span><span>Ping</span><span>Player / user ID</span><span></span></div>{filtered.map((player) => <div className="table-row" key={player.userId || player.playerId}><span className="player-cell"><i>{player.name.slice(0, 1).toUpperCase()}</i><span><strong>{player.name}</strong><small>{player.accountName}</small></span></span><span>{formatValue(player.level)}</span><span>{player.ping === undefined ? '—' : `${Math.round(player.ping)} ms`}</span><span className="mono" title={`${player.playerId ?? ''} ${player.userId}`}>{player.userId || player.playerId}</span><span className="row-actions"><button title="Kick player" onClick={() => { if (confirm(`Kick ${player.name}?`)) onAction('kick', { userId: player.userId || player.playerId }, `${player.name} was kicked`); }}><Unplug /></button><button title="Ban player" className="danger-text" onClick={() => { if (confirm(`Ban ${player.name}? This blocks them from reconnecting.`)) onAction('ban', { userId: player.userId || player.playerId }, `${player.name} was banned`); }}><Ban /></button></span></div>)}</div>{!filtered.length && <div className="empty-list">{players.length ? 'No players match your search' : 'No players are currently online'}</div>}
  </section>;
}

function ConsolePage({ activeId, logs, addLog }: { activeId: string; logs: LogEntry[]; addLog(k: LogEntry['kind'], t: string): void }) {
  const [command, setCommand] = useState(''); const [running, setRunning] = useState(false); const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [logs]);
  async function run(value = command) {
    const normalized = value.trim().replace(/^\/+/, ''); if (!normalized || running) return;
    setRunning(true); setCommand(''); addLog('command', `> ${normalized}`);
    try { const result = await window.palrcon.server.command(activeId, normalized); addLog('success', result || 'Command completed successfully.'); }
    catch (reason) { addLog('error', errorMessage(reason)); }
    finally { setRunning(false); }
  }
  return <div className="console-layout"><section className="console-panel"><div className="console-output" aria-live="polite">{logs.map((entry) => <div key={entry.id} className={`log-${entry.kind}`}><time>{entry.time.toLocaleTimeString([], { hour12: false })}</time><pre>{entry.text}</pre></div>)}<div ref={endRef} /></div><div className="command-line"><span>&gt;</span><input autoFocus value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run(); }} placeholder="Enter an RCON command" disabled={running} /><button className="button primary" onClick={() => void run()} disabled={!command.trim() || running}><Play size={15} />Run</button></div></section><aside className="command-reference"><h2>Command reference</h2><p>Click a command to insert or run it.</p>{commands.map((item) => <button key={item.label} onClick={() => item.value.endsWith(' ') ? setCommand(item.value) : void run(item.value)}><code>{item.value}</code><span>{item.label}</span></button>)}</aside></div>;
}

function SettingsPage({ profile, data, onEdit, onAdd, onRemove }: { profile: ServerProfile; data?: DashboardData; onEdit(): void; onAdd(): void; onRemove(): void }) {
  const settings = data?.settings ?? {};
  return <div className="settings-layout"><section className="panel"><div className="panel-header"><div><h2>Connection</h2><p>Stored locally with an encrypted password</p></div><button className="button secondary" onClick={onEdit}><Pencil size={14} />Edit</button></div><dl className="connection-list"><Detail label="Server name" value={profile.name} /><Detail label="Address" value={profile.host} /><Detail label="RCON port" value={profile.rconPort} /><Detail label="REST API" value={profile.restEnabled ? `Enabled · ${profile.restPort}` : 'Disabled'} /></dl><div className="settings-actions"><button className="button secondary" onClick={onAdd}><Server size={15} />Add another server</button><button className="button danger" onClick={onRemove}><Trash2 size={15} />Remove server</button></div></section><section className="panel settings-values"><div className="panel-header"><div><h2>Game settings</h2><p>Read-only values reported by the REST API</p></div></div>{Object.keys(settings).length ? <dl>{Object.entries(settings).map(([key, value]) => <Detail key={key} label={key} value={value} />)}</dl> : <div className="empty-list">Enable the REST API to view server settings.</div>}</section></div>;
}
