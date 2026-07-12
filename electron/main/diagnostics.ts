import dns from 'node:dns/promises';
import net from 'node:net';
import type { ServerProfile } from './profile-store.js';
import { RconClient } from './rcon.js';
import { PalworldRestClient } from './rest.js';

export interface DiagnosticCheck {
  status: 'pass' | 'fail' | 'skipped';
  latencyMs?: number;
  detail: string;
}

function errorText(error: unknown) { return error instanceof Error ? error.message : String(error); }

async function timed<T>(operation: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = performance.now();
  const value = await operation();
  return { value, latencyMs: Math.round(performance.now() - started) };
}

async function tcpCheck(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('TCP connection timed out after 4 seconds.')); }, 4_000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(); });
    socket.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

export async function runDiagnostics(profile: ServerProfile) {
  const checkedAt = new Date().toISOString();
  let dnsCheck: DiagnosticCheck;
  try {
    const result = await timed(() => dns.lookup(profile.host, { all: true }));
    dnsCheck = { status: 'pass', latencyMs: result.latencyMs, detail: result.value.map((item) => item.address).join(', ') };
  } catch (error) { dnsCheck = { status: 'fail', detail: errorText(error) }; }

  let tcp: DiagnosticCheck;
  try {
    const result = await timed(() => tcpCheck(profile.host, profile.rconPort));
    tcp = { status: 'pass', latencyMs: result.latencyMs, detail: `Connected to port ${profile.rconPort}.` };
  } catch (error) { tcp = { status: 'fail', detail: errorText(error) }; }

  const client = new RconClient(profile.host, profile.rconPort, profile.password);
  let rcon: DiagnosticCheck;
  try {
    const result = await timed(() => client.probe());
    rcon = { status: 'pass', latencyMs: result.latencyMs, detail: 'Authentication accepted; no command was executed.' };
  } catch (error) { rcon = { status: 'fail', detail: errorText(error) }; }

  let rest: DiagnosticCheck;
  if (!profile.restEnabled) rest = { status: 'skipped', detail: 'REST API is disabled in this profile.' };
  else {
    try {
      const result = await timed(() => new PalworldRestClient(profile).info());
      rest = { status: 'pass', latencyMs: result.latencyMs, detail: 'Authenticated GET /info succeeded.' };
    } catch (error) { rest = { status: 'fail', detail: errorText(error) }; }
  }

  return {
    checkedAt,
    target: { name: profile.name, host: profile.host, rconPort: profile.rconPort, restPort: profile.restEnabled ? profile.restPort : null },
    checks: { dns: dnsCheck, tcp, rcon, rest },
    rconPackets: client.getPacketTrace()
  };
}
