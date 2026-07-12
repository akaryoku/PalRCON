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

export interface Preferences { checkForUpdatesOnStartup: boolean }
export interface UpdateResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseName: string;
  releaseUrl: string;
  publishedAt: string | null;
  notes: string;
}
export interface DiagnosticCheck { status: 'pass' | 'fail' | 'skipped'; latencyMs?: number; detail: string }
export interface DiagnosticsResult {
  checkedAt: string;
  target: { name: string; host: string; rconPort: number; restPort: number | null };
  checks: { dns: DiagnosticCheck; tcp: DiagnosticCheck; rcon: DiagnosticCheck; rest: DiagnosticCheck };
  rconPackets: Array<{ phase: 'auth' | 'response'; id: number; type: number; bodyLength: number }>;
}
export interface ConsoleLogEntry { id: string; time: Date; kind: 'command' | 'success' | 'error' | 'system'; text: string }
export interface AutomationDefinition {
  id: string;
  profileId: string;
  name: string;
  command: string;
  intervalMinutes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: 'success' | 'error';
  lastMessage?: string;
}
export type AutomationInput = Pick<AutomationDefinition, 'id' | 'profileId' | 'name' | 'command' | 'intervalMinutes' | 'enabled'>;
export interface AutomationResult {
  automationId: string;
  profileId: string;
  name: string;
  command: string;
  status: 'success' | 'error';
  response?: string;
  error?: string;
  runAt: string;
  scheduled: boolean;
}

export interface PalRconApi {
  profiles: {
    list(): Promise<ServerProfile[]>;
    save(profile: ServerProfile): Promise<ServerProfile[]>;
    remove(id: string): Promise<ServerProfile[]>;
    export(): Promise<{ canceled: boolean; count?: number; filePath?: string }>;
    import(): Promise<{ canceled: boolean; count: number; profiles: ServerProfile[] }>;
  };
  server: {
    test(profile: ServerProfile): Promise<{ rcon: boolean; rest: boolean; restError?: string; latencyMs: number }>;
    dashboard(profileId: string): Promise<DashboardData>;
    command(profileId: string, command: string): Promise<string>;
    action(profileId: string, action: string, payload?: Record<string, unknown>): Promise<unknown>;
    diagnostics(profileId: string): Promise<DiagnosticsResult>;
  };
  preferences: { get(): Promise<Preferences>; set(value: Preferences): Promise<Preferences> };
  updates: { check(): Promise<UpdateResult>; open(): Promise<void> };
  clipboard: { write(value: string): Promise<void> };
  logs: { export(entries: Array<{ time: string; kind: string; text: string }>): Promise<{ canceled: boolean; filePath?: string }> };
  automations: {
    list(): Promise<AutomationDefinition[]>;
    save(value: AutomationInput): Promise<AutomationDefinition[]>;
    remove(id: string): Promise<AutomationDefinition[]>;
    setEnabled(id: string, enabled: boolean): Promise<AutomationDefinition[]>;
    runNow(id: string): Promise<AutomationResult>;
    onResult(callback: (value: AutomationResult) => void): () => void;
  };
}

declare global { interface Window { palrcon: PalRconApi } }
