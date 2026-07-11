import { describe, expect, it } from 'vitest';
import { decodePackets, encodePacket } from './rcon.js';

describe('RCON packet codec', () => {
  it('round trips UTF-8 packets', () => {
    const encoded = encodePacket(7, 2, 'Broadcast Héllo');
    const decoded = decodePackets(encoded);
    expect(decoded.remainder.length).toBe(0);
    expect(decoded.packets).toEqual([{ id: 7, type: 2, body: 'Broadcast Héllo' }]);
  });
  it('retains incomplete packets', () => {
    const packet = encodePacket(1, 3, 'secret');
    const decoded = decodePackets(packet.subarray(0, 8));
    expect(decoded.packets).toEqual([]);
    expect(decoded.remainder.length).toBe(8);
  });
});
