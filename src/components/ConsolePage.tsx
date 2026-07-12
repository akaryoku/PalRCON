import { Check, Clipboard, Download, Play, Star, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, isScrollNearBottom } from '../lib';
import type { ConsoleLogEntry } from '../types';

export const commandCatalog = [
  { label: 'Server info', value: 'Info' }, { label: 'Show players', value: 'ShowPlayers' },
  { label: 'Save world', value: 'Save' }, { label: 'Broadcast…', value: 'Broadcast ' },
  { label: 'Kick player…', value: 'KickPlayer ' }, { label: 'Ban player…', value: 'BanPlayer ' },
  { label: 'Unban player…', value: 'UnBanPlayer ' }, { label: 'Shutdown…', value: 'Shutdown 60 ' }
];

interface Props {
  activeId: string;
  logs: ConsoleLogEntry[];
  addLog(kind: ConsoleLogEntry['kind'], text: string): void;
  clearLogs(): void;
  onResponse(command: string, response: string): void;
  notify(message: string): void;
}

export function ConsolePage({ activeId, logs, addLog, clearLogs, onResponse, notify }: Props) {
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [copiedId, setCopiedId] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('palrcon.consoleFavorites') ?? '[]') as string[]; }
    catch { return []; }
  });
  const outputRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const history = useMemo(() => logs.filter((entry) => entry.kind === 'command').map((entry) => entry.text.replace(/^>\s*/, '')), [logs]);
  const suggestions = useMemo(() => {
    const source = [...new Set([...favorites, ...commandCatalog.map((item) => item.value)])];
    const query = command.toLowerCase();
    return query ? source.filter((value) => value.toLowerCase().startsWith(query) && value.toLowerCase() !== query).slice(0, 5) : [];
  }, [command, favorites]);

  useLayoutEffect(() => {
    const output = outputRef.current;
    if (output && pinnedToBottom.current) output.scrollTop = output.scrollHeight;
  }, [logs]);
  useEffect(() => localStorage.setItem('palrcon.consoleFavorites', JSON.stringify(favorites)), [favorites]);

  async function run(value = command) {
    const normalized = value.trim().replace(/^\/+/, '');
    if (!normalized || running) return;
    setRunning(true); setCommand(''); setHistoryOffset(0); addLog('command', `> ${normalized}`);
    try {
      const result = await window.palrcon.server.command(activeId, normalized);
      const response = result || 'Command completed successfully.';
      addLog('success', response); onResponse(normalized, result);
    } catch (reason) { addLog('error', errorMessage(reason)); }
    finally { setRunning(false); }
  }

  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') { event.preventDefault(); void run(); return; }
    if (event.key === 'Tab' && suggestions[0]) { event.preventDefault(); setCommand(suggestions[0]); return; }
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault(); const next = Math.min(historyOffset + 1, history.length); setHistoryOffset(next); setCommand(history[history.length - next]);
    } else if (event.key === 'ArrowDown' && historyOffset) {
      event.preventDefault(); const next = Math.max(historyOffset - 1, 0); setHistoryOffset(next); setCommand(next ? history[history.length - next] : '');
    }
  }

  async function copy(value: string, id = '') {
    await window.palrcon.clipboard.write(value); setCopiedId(id); notify('Copied to clipboard');
    if (id) setTimeout(() => setCopiedId(''), 1_500);
  }

  async function exportLog() {
    const result = await window.palrcon.logs.export(logs.map((entry) => ({ time: entry.time.toISOString(), kind: entry.kind, text: entry.text })));
    if (!result.canceled) notify('Console log exported');
  }

  function toggleFavorite(value: string) { setFavorites((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }

  return <div className="console-layout">
    <section className="console-panel">
      <div className="console-toolbar"><span>{logs.length} entries</span><div><button onClick={() => void copy(logs.map((entry) => `[${entry.time.toISOString()}] ${entry.text}`).join('\n'))}><Clipboard />Copy all</button><button onClick={() => void exportLog()}><Download />Export</button><button onClick={clearLogs}><Trash2 />Clear</button></div></div>
      <div className="console-output" ref={outputRef} onScroll={(event) => { const output = event.currentTarget; pinnedToBottom.current = isScrollNearBottom(output.scrollHeight, output.scrollTop, output.clientHeight); }} aria-live="polite">{logs.map((entry) => <div key={entry.id} className={`log-${entry.kind}`}><time>{entry.time.toLocaleTimeString([], { hour12: false })}</time><pre>{entry.text}</pre><button className="copy-log" title="Copy entry" onClick={() => void copy(entry.text, entry.id)}>{copiedId === entry.id ? <Check /> : <Clipboard />}</button></div>)}</div>
      <div className="command-composer">
        {suggestions.length > 0 && <div className="command-suggestions">{suggestions.map((value) => <button key={value} onMouseDown={(event) => { event.preventDefault(); setCommand(value); }}><code>{value}</code><span>Tab to complete</span></button>)}</div>}
        <div className="command-line"><span>&gt;</span><input autoFocus value={command} onChange={(event) => { setCommand(event.target.value); setHistoryOffset(0); }} onKeyDown={keyDown} placeholder="Enter an RCON command" disabled={running} /><button className="button primary" onClick={() => void run()} disabled={!command.trim() || running}><Play size={15} />{running ? 'Running' : 'Run'}</button></div>
      </div>
    </section>
    <aside className="command-reference"><h2>Command reference</h2><p>Click to insert or run. Star frequently used commands.</p>{commandCatalog.map((item) => <div className="command-reference-row" key={item.label}><button className="command-choice" onClick={() => item.value.endsWith(' ') ? setCommand(item.value) : void run(item.value)}><code>{item.value}</code><span>{item.label}</span></button><button className={favorites.includes(item.value) ? 'favorite active' : 'favorite'} title="Toggle favorite" onClick={() => toggleFavorite(item.value)}><Star /></button></div>)}</aside>
  </div>;
}
