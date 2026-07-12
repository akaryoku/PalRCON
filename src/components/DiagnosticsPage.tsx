import { CheckCircle2, Clipboard, LoaderCircle, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../lib';
import type { DiagnosticsResult, ServerProfile } from '../types';

function report(result: DiagnosticsResult) {
  const lines = [`PalRCON diagnostic report`, `Checked: ${result.checkedAt}`, `Profile: ${result.target.name}`, `Target: ${result.target.host}:${result.target.rconPort}`, ''];
  for (const [name, check] of Object.entries(result.checks)) lines.push(`${name.toUpperCase()}: ${check.status}${check.latencyMs === undefined ? '' : ` (${check.latencyMs} ms)`} — ${check.detail}`);
  lines.push('', 'RCON packet metadata:', ...result.rconPackets.map((packet) => `${packet.phase}: id=${packet.id}, type=${packet.type}, bodyLength=${packet.bodyLength}`), '', 'Credentials are intentionally excluded.');
  return lines.join('\n');
}

export function DiagnosticsPage({ profile, notify }: { profile: ServerProfile; notify(message: string): void }) {
  const [result, setResult] = useState<DiagnosticsResult>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setRunning(true); setError('');
    try { setResult(await window.palrcon.server.diagnostics(profile.id)); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setRunning(false); }
  }
  async function copy() { if (result) { await window.palrcon.clipboard.write(report(result)); notify('Diagnostic report copied'); } }
  return <div className="diagnostics-page">
    <section className="panel diagnostics-intro"><div><h2>Connection diagnostics</h2><p>Runs DNS, TCP, RCON authentication, and optional REST checks. No RCON command is executed and credentials are excluded from reports.</p></div><button className="button primary" onClick={() => void run()} disabled={running}>{running ? <LoaderCircle className="spin" /> : <Play />}{running ? 'Running checks' : 'Run diagnostics'}</button></section>
    {error && <div className="form-result error">{error}</div>}
    {result && <><section className="diagnostic-grid">{Object.entries(result.checks).map(([name, check]) => <div className={`diagnostic-check ${check.status}`} key={name}>{check.status === 'pass' ? <CheckCircle2 /> : check.status === 'fail' ? <XCircle /> : <span>—</span>}<div><h3>{name === 'rcon' ? 'RCON authentication' : name.toUpperCase()}</h3><strong>{check.status}{check.latencyMs === undefined ? '' : ` · ${check.latencyMs} ms`}</strong><p>{check.detail}</p></div></div>)}</section>
      <section className="panel packet-panel"><div className="panel-header"><div><h2>RCON packet metadata</h2><p>Headers only; response content and credentials are omitted</p></div><button className="button secondary" onClick={() => void copy()}><Clipboard />Copy report</button></div><div className="packet-table"><div><span>Phase</span><span>ID</span><span>Type</span><span>Body bytes</span></div>{result.rconPackets.map((packet, index) => <div key={`${packet.phase}-${index}`}><span>{packet.phase}</span><code>{packet.id}</code><code>{packet.type}</code><code>{packet.bodyLength}</code></div>)}</div></section></>}
    {!result && !error && <div className="diagnostics-empty">Diagnostics run only when requested.</div>}
  </div>;
}
