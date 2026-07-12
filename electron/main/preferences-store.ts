import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface Preferences {
  checkForUpdatesOnStartup: boolean;
}

const defaults: Preferences = { checkForUpdatesOnStartup: false };

export class PreferencesStore {
  private get filePath() { return path.join(app.getPath('userData'), 'preferences.json'); }

  async get(): Promise<Preferences> {
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<Preferences>;
      return { ...defaults, checkForUpdatesOnStartup: stored.checkForUpdatesOnStartup === true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaults };
      return { ...defaults };
    }
  }

  async set(next: Preferences): Promise<Preferences> {
    const value = { checkForUpdatesOnStartup: next.checkForUpdatesOnStartup === true };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    return value;
  }
}
