import { describe, expect, it } from 'vitest';
import { formatUptime, isScrollNearBottom, parseRconInfo, parseRconPlayers, rconCommandName } from './lib';

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

describe('structured RCON responses', () => {
  it('parses Palworld Info output', () => expect(parseRconInfo('Welcome to Pal Server[v1.0.0.100427] Blue Garden Public\n')).toEqual({ version: 'v1.0.0.100427', servername: 'Blue Garden Public', raw: 'Welcome to Pal Server[v1.0.0.100427] Blue Garden Public' }));
  it('normalizes slash-prefixed command names', () => expect(rconCommandName('/ShowPlayers')).toBe('showplayers'));
});

describe('console scroll position', () => {
  it('keeps following output while near the bottom', () => expect(isScrollNearBottom(1_000, 570, 400)).toBe(true));
  it('preserves the position after an admin scrolls upward', () => expect(isScrollNearBottom(1_000, 200, 400)).toBe(false));
});
