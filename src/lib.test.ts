import { describe, expect, it } from 'vitest';
import { formatUptime, parseRconPlayers } from './lib';

describe('parseRconPlayers', () => {
  it('parses Palworld CSV output', () => {
    expect(parseRconPlayers('name,playeruid,steamid\r\nDrew,ABC123,steam_123\r\n')).toEqual([
      { name: 'Drew', playerId: 'ABC123', userId: 'steam_123' }
    ]);
  });
  it('returns no players for a header-only response', () => expect(parseRconPlayers('name,playeruid,steamid')).toEqual([]));
});

describe('formatUptime', () => {
  it('formats server seconds compactly', () => expect(formatUptime(93720)).toBe('1d 2h 2m'));
  it('handles unavailable values', () => expect(formatUptime(undefined)).toBe('—'));
});
