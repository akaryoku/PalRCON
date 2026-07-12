import net from 'node:net';

const AUTH = 3;
const COMMAND = 2;
const RESPONSE_VALUE = 0;

export interface RconPacket {
  id: number;
  type: number;
  body: string;
}

export function encodePacket(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, 'utf8');
  const packet = Buffer.alloc(payload.length + 14);
  packet.writeInt32LE(payload.length + 10, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  payload.copy(packet, 12);
  return packet;
}

export function decodePackets(input: Buffer): { packets: RconPacket[]; remainder: Buffer } {
  const packets: RconPacket[] = [];
  let offset = 0;
  while (input.length - offset >= 4) {
    const size = input.readInt32LE(offset);
    if (size < 10 || size > 4_096_000) throw new Error('Server returned an invalid RCON packet.');
    if (input.length - offset < size + 4) break;
    const packet = input.subarray(offset, offset + size + 4);
    packets.push({
      id: packet.readInt32LE(4),
      type: packet.readInt32LE(8),
      body: packet.subarray(12, packet.length - 2).toString('utf8')
    });
    offset += size + 4;
  }
  return { packets, remainder: input.subarray(offset) };
}

export class RconClient {
  private readonly packetTrace: Array<{ phase: 'auth' | 'response'; id: number; type: number; bodyLength: number }> = [];
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly password: string,
    private readonly timeoutMs = 5_000
  ) {}

  probe(): Promise<void> {
    return this.request().then(() => undefined);
  }

  getPacketTrace() { return this.packetTrace.map((packet) => ({ ...packet })); }

  execute(rawCommand: string): Promise<string> {
    const command = rawCommand.trim().replace(/^\/+/, '');
    if (!command) return Promise.reject(new Error('Enter a command to run.'));
    return this.request(command);
  }

  private request(command?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let authenticated = false;
      let commandSent = false;
      let settled = false;
      let chunks: string[] = [];
      let quietTimer: NodeJS.Timeout | undefined;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (quietTimer) clearTimeout(quietTimer);
        // RCON servers commonly keep connections open. Resetting the socket avoids
        // accumulating FIN_WAIT_2 connections when an endpoint accepts TCP but
        // never completes the RCON handshake.
        if (!socket.destroyed) {
          if (typeof socket.resetAndDestroy === 'function') socket.resetAndDestroy();
          else socket.destroy();
        }
        error ? reject(error) : resolve(chunks.join(''));
      };

      const armQuietTimer = () => {
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(() => finish(), 120);
      };

      socket.setTimeout(this.timeoutMs);
      socket.once('connect', () => socket.write(encodePacket(1, AUTH, this.password)));
      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        let decoded: ReturnType<typeof decodePackets>;
        try {
          decoded = decodePackets(buffer);
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        buffer = decoded.remainder;
        for (const packet of decoded.packets) {
          this.packetTrace.push({ phase: authenticated ? 'response' : 'auth', id: packet.id, type: packet.type, bodyLength: packet.body.length });
          if (!authenticated) {
            if (packet.id === -1) {
              finish(new Error('RCON authentication failed. Check the admin password.'));
              return;
            }
            if (packet.id === 1 && packet.type === COMMAND) {
              authenticated = true;
              if (command === undefined) {
                finish();
                return;
              }
              socket.write(encodePacket(2, COMMAND, command));
              commandSent = true;
            }
            continue;
          }
          // Palworld is known to return command responses with ID 0 instead of
          // mirroring the client request ID. Authentication still validates its
          // ID above; after authentication, packet type identifies the response.
          if (packet.id !== -1 && (packet.type === RESPONSE_VALUE || packet.type === COMMAND)) {
            chunks.push(packet.body);
            armQuietTimer();
          }
        }
      });
      socket.once('timeout', () => {
        if (authenticated && commandSent) {
          chunks.push('Command sent. The server did not return an RCON response.');
          finish();
        } else {
          finish(new Error(`RCON connection timed out after ${this.timeoutMs / 1000} seconds.`));
        }
      });
      socket.once('error', (error) => finish(new Error(`RCON connection failed: ${error.message}`)));
      socket.once('close', () => {
        if (!settled) authenticated ? finish() : finish(new Error('The server closed the RCON connection.'));
      });
    });
  }
}
