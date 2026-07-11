import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

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

type StoredProfile = Omit<ServerProfile, 'password' | 'credentialError'> & { encryptedPassword: string };

export class ProfileStore {
  private get filePath() { return path.join(app.getPath('userData'), 'profiles.json'); }

  async list(): Promise<ServerProfile[]> {
    const stored = await this.readStored();
    return stored.map(({ encryptedPassword, ...profile }) => {
      try { return { ...profile, password: this.decrypt(encryptedPassword) }; }
      catch { return { ...profile, password: '', credentialError: true }; }
    });
  }

  private async readStored(): Promise<StoredProfile[]> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8')) as StoredProfile[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new Error('Saved server profiles could not be read.');
    }
  }

  async save(profile: ServerProfile): Promise<ServerProfile[]> {
    const profiles = await this.readStored();
    const { password, credentialError: _credentialError, ...metadata } = profile;
    const next: StoredProfile[] = [...profiles.filter((item) => item.id !== profile.id), { ...metadata, encryptedPassword: this.encrypt(password) }];
    await this.write(next);
    return this.list();
  }

  async remove(id: string): Promise<ServerProfile[]> {
    const next = (await this.readStored()).filter((profile) => profile.id !== id);
    await this.write(next);
    return this.list();
  }

  private async write(stored: StoredProfile[]) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(stored, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  private encrypt(value: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable on this computer.');
    return safeStorage.encryptString(value).toString('base64');
  }

  private decrypt(value: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable on this computer.');
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  }
}
