export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  rconPort: number;
  restPort: number;
  restEnabled: boolean;
  password: string;
  credentialError?: boolean;
}

export interface Player {
  name: string;
  accountName?: string;
  playerId?: string;
  userId: string;
  ip?: string;
  ping?: number;
  level?: number;
  building_count?: number;
}

export interface DashboardData {
  source: 'rest' | 'rcon';
  info: Record<string, unknown>;
  players?: Player[];
  playersRaw?: string;
  metrics: Record<string, unknown>;
  settings: Record<string, unknown>;
  warning?: string;
  refreshedAt: number;
}

export interface PalRconApi {
  profiles: {
    list(): Promise<ServerProfile[]>;
    save(profile: ServerProfile): Promise<ServerProfile[]>;
    remove(id: string): Promise<ServerProfile[]>;
  };
  server: {
    test(profile: ServerProfile): Promise<{ rcon: boolean; rest: boolean; restError?: string; latencyMs: number }>;
    dashboard(profileId: string): Promise<DashboardData>;
    command(profileId: string, command: string): Promise<string>;
    action(profileId: string, action: string, payload?: Record<string, unknown>): Promise<unknown>;
  };
}

declare global { interface Window { palrcon: PalRconApi } }
