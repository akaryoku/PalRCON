import { Eye, EyeOff, PlugZap, Server } from 'lucide-react';
import { useState } from 'react';
import type { ServerProfile } from '../types';
import { errorMessage } from '../lib';

interface Props {
  initial?: ServerProfile;
  onCancel?: () => void;
  onSave(profile: ServerProfile): Promise<void>;
}

const emptyProfile = (): ServerProfile => ({
  id: crypto.randomUUID(), name: '', host: '', rconPort: 25575, restPort: 8212, restEnabled: true, password: ''
});

export function ProfileForm({ initial, onCancel, onSave }: Props) {
  const [profile, setProfile] = useState<ServerProfile>(initial ?? emptyProfile());
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'warn' | 'error'; message: string } | undefined>(initial?.credentialError ? { kind: 'warn', message: 'The password from an earlier build cannot be decrypted. Enter it again to repair this profile.' } : undefined);
  const update = <K extends keyof ServerProfile>(key: K, value: ServerProfile[K]) => setProfile((current) => ({ ...current, [key]: value }));

  async function test() {
    setTesting(true); setResult(undefined);
    try {
      const value = await window.palrcon.server.test(profile);
      setResult(value.restError
        ? { kind: 'warn', message: `RCON connected in ${value.latencyMs}ms. REST API unavailable: ${value.restError}` }
        : { kind: 'ok', message: `RCON${profile.restEnabled ? ' and REST API' : ''} connected in ${value.latencyMs}ms.` });
    } catch (error) { setResult({ kind: 'error', message: errorMessage(error) }); }
    finally { setTesting(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setResult(undefined);
    try { await onSave(profile); }
    catch (error) { setResult({ kind: 'error', message: errorMessage(error) }); }
    finally { setSaving(false); }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="form-title"><Server size={20} /><div><h2>{initial ? 'Edit server' : 'Add a Palworld server'}</h2><p>Credentials stay encrypted on this computer.</p></div></div>
      <div className="field"><label htmlFor="name">Display name</label><input id="name" required autoFocus value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="Community Server" /></div>
      <div className="form-row">
        <div className="field grow"><label htmlFor="host">Hostname or IP</label><input id="host" required value={profile.host} onChange={(e) => update('host', e.target.value)} placeholder="127.0.0.1" /></div>
        <div className="field port"><label htmlFor="rconPort">RCON port</label><input id="rconPort" type="number" min="1" max="65535" required value={profile.rconPort} onChange={(e) => update('rconPort', Number(e.target.value))} /></div>
      </div>
      <div className="field"><label htmlFor="password">Admin password</label><div className="password-input"><input id="password" required type={showPassword ? 'text' : 'password'} value={profile.password} onChange={(e) => update('password', e.target.value)} autoComplete="new-password" /><button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
      <label className="check-row"><input type="checkbox" checked={profile.restEnabled} onChange={(e) => update('restEnabled', e.target.checked)} /><span><strong>Use Palworld REST API</strong><small>Provides live metrics, settings, and richer player details.</small></span></label>
      {profile.restEnabled && <div className="field rest-port"><label htmlFor="restPort">REST API port</label><input id="restPort" type="number" min="1" max="65535" required value={profile.restPort} onChange={(e) => update('restPort', Number(e.target.value))} /></div>}
      {result && <div className={`form-result ${result.kind}`} role="status">{result.message}</div>}
      <div className="form-actions">
        {onCancel && <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>}
        <button className="button secondary" type="button" onClick={test} disabled={testing || saving}><PlugZap size={16} />{testing ? 'Testing…' : 'Test connection'}</button>
        <button className="button primary" type="submit" disabled={testing || saving}>{saving ? 'Saving…' : 'Save server'}</button>
      </div>
    </form>
  );
}
