import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { decodePackets, encodePacket, RconClient } from './rcon.js';

const servers: net.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function listen(server: net.Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as net.AddressInfo).port;
}

describe('RconClient', () => {
  it('tests authentication without sending a command packet', async () => {
    let commandPackets = 0;
    const server = net.createServer((socket) => {
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const decoded = decodePackets(buffer);
        buffer = decoded.remainder;
        for (const packet of decoded.packets) {
          if (packet.type === 3) socket.write(encodePacket(packet.id, 2, ''));
          else commandPackets += 1;
        }
      });
    });
    const port = await listen(server);
    await new RconClient('127.0.0.1', port, 'secret', 1_000).probe();
    expect(commandPackets).toBe(0);
  });

  it('authenticates, executes a command, and returns the response', async () => {
    const server = net.createServer((socket) => {
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const decoded = decodePackets(buffer);
        buffer = decoded.remainder;
        for (const packet of decoded.packets) {
          if (packet.type === 3) socket.write(encodePacket(packet.id, 2, ''));
          // Palworld commonly responds with ID 0 instead of echoing the command ID.
          else if (packet.type === 2) socket.write(encodePacket(0, 0, `ran:${packet.body}`));
        }
      });
    });
    const port = await listen(server);
    await expect(new RconClient('127.0.0.1', port, 'secret', 1_000).execute('/Info')).resolves.toBe('ran:Info');
  });

  it('times out cleanly when a TCP endpoint never speaks RCON', async () => {
    const server = net.createServer((socket) => socket.on('error', () => undefined));
    const port = await listen(server);
    await expect(new RconClient('127.0.0.1', port, 'secret', 80).execute('Info')).rejects.toThrow('timed out');
  });

  it('reports a sent command when an authenticated server returns no body', async () => {
    const server = net.createServer((socket) => {
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const decoded = decodePackets(buffer);
        buffer = decoded.remainder;
        for (const packet of decoded.packets) if (packet.type === 3) socket.write(encodePacket(packet.id, 2, ''));
      });
    });
    const port = await listen(server);
    await expect(new RconClient('127.0.0.1', port, 'secret', 80).execute('Save')).resolves.toContain('did not return');
  });
});
