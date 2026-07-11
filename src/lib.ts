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
