import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

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

export type AutomationInput = Pick<AutomationDefinition, 'id' | 'profileId' | 'name' | 'command' | 'intervalMinutes' | 'enabled'>;

export function nextRunAt(intervalMinutes: number, now = Date.now()) {
  return new Date(now + intervalMinutes * 60_000).toISOString();
}

export function isDestructiveAutomationCommand(command: string) {
  return /^(?:\/+)?(?:doexit|shutdown|kickplayer|banplayer|unbanplayer)\b/i.test(command.trim());
}

export class AutomationService {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<string>();
  private definitions: AutomationDefinition[] = [];

  constructor(
    private readonly executeCommand: (definition: AutomationDefinition) => Promise<string>,
    private readonly emitResult: (result: AutomationResult) => void
  ) {}

  private get filePath() { return path.join(app.getPath('userData'), 'automations.json'); }

  async start() {
    this.definitions = await this.read();
    for (const definition of this.definitions) if (definition.enabled) this.schedule(definition.id);
  }

  stop() { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }

  list() { return this.definitions.map((definition) => ({ ...definition })); }

  async save(input: AutomationInput) {
    const existing = this.definitions.find((definition) => definition.id === input.id);
    const now = new Date().toISOString();
    const definition: AutomationDefinition = {
      ...existing,
      ...input,
      command: input.command.trim().replace(/^\/+/, ''),
      name: input.name.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      nextRunAt: undefined
    };
    this.definitions = [...this.definitions.filter((item) => item.id !== definition.id), definition];
    this.clearTimer(definition.id);
    if (definition.enabled) this.schedule(definition.id);
    await this.write();
    return this.list();
  }

  async remove(id: string) {
    this.clearTimer(id);
    this.definitions = this.definitions.filter((definition) => definition.id !== id);
    await this.write();
    return this.list();
  }

  async removeForProfile(profileId: string) {
    for (const definition of this.definitions.filter((item) => item.profileId === profileId)) this.clearTimer(definition.id);
    this.definitions = this.definitions.filter((definition) => definition.profileId !== profileId);
    await this.write();
  }

  async setEnabled(id: string, enabled: boolean) {
    const definition = this.requireDefinition(id);
    definition.enabled = enabled; definition.updatedAt = new Date().toISOString(); definition.nextRunAt = undefined;
    this.clearTimer(id);
    if (enabled) this.schedule(id);
    await this.write();
    return this.list();
  }

  async runNow(id: string) {
    const result = await this.run(id, false);
    if (!result) throw new Error('This automation is already running.');
    return result;
  }

  private schedule(id: string) {
    const definition = this.requireDefinition(id);
    if (!definition.enabled) return;
    const delay = definition.intervalMinutes * 60_000;
    definition.nextRunAt = nextRunAt(definition.intervalMinutes);
    const timer = setTimeout(() => { this.timers.delete(id); void this.run(id, true); }, delay);
    this.timers.set(id, timer);
  }

  private async run(id: string, scheduled: boolean) {
    const definition = this.requireDefinition(id);
    if (this.running.has(id)) {
      if (scheduled && definition.enabled) { this.schedule(id); return undefined; }
      throw new Error('This automation is already running.');
    }
    const preservedNextRun = scheduled ? undefined : definition.nextRunAt;
    this.running.add(id);
    const runAt = new Date().toISOString();
    let result: AutomationResult;
    try {
      const response = await this.executeCommand(definition);
      result = { automationId: id, profileId: definition.profileId, name: definition.name, command: definition.command, status: 'success', response, runAt, scheduled };
      definition.lastStatus = 'success'; definition.lastMessage = (response || 'Command completed successfully.').slice(0, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = { automationId: id, profileId: definition.profileId, name: definition.name, command: definition.command, status: 'error', error: message, runAt, scheduled };
      definition.lastStatus = 'error'; definition.lastMessage = message.slice(0, 500);
    } finally { this.running.delete(id); }
    definition.lastRunAt = runAt; definition.nextRunAt = preservedNextRun;
    if (scheduled && definition.enabled) this.schedule(id);
    await this.write(); this.emitResult(result);
    return result;
  }

  private requireDefinition(id: string) {
    const definition = this.definitions.find((item) => item.id === id);
    if (!definition) throw new Error('That automation no longer exists.');
    return definition;
  }

  private clearTimer(id: string) { const timer = this.timers.get(id); if (timer) clearTimeout(timer); this.timers.delete(id); }

  private async read(): Promise<AutomationDefinition[]> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as AutomationDefinition[];
      return parsed.map((definition) => ({ ...definition, nextRunAt: undefined }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new Error('Saved automations could not be read.');
    }
  }

  private async write() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.definitions, null, 2), { encoding: 'utf8', mode: 0o600 });
  }
}
