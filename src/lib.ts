import type { Player } from './types';

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

export function parseRconPlayers(raw = ''): Player[] {
  const lines = raw.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const [name = 'Unknown', playerId = '', userId = ''] = line.split(',').map((value) => value.trim());
    return { name, playerId, userId };
  }).filter((player) => player.userId || player.playerId);
}

export function parseRconInfo(raw = ''): Record<string, string> {
  const normalized = raw.trim();
  const match = normalized.match(/^Welcome to Pal Server\[([^\]]+)]\s*(.*)$/i);
  if (!match) return { raw: normalized };
  return { version: match[1], servername: match[2].trim() || 'Palworld server', raw: normalized };
}

export function rconCommandName(command: string) {
  return command.trim().replace(/^\/+/, '').split(/\s+/, 1)[0].toLowerCase();
}

export function isScrollNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number, threshold = 48) {
  return scrollHeight - scrollTop - clientHeight < threshold;
}

export function formatUptime(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${minutes}m`].filter(Boolean).join(' ');
}

export function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
