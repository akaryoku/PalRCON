import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { ProfileStore, type ServerProfile } from './profile-store.js';
import { RconClient } from './rcon.js';
import { PalworldRestClient } from './rest.js';

const profileSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  host: z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.:[\]-]+$/, 'Enter a valid hostname or IP address.'),
  rconPort: z.number().int().min(1).max(65535),
  restPort: z.number().int().min(1).max(65535),
  restEnabled: z.boolean(),
  password: z.string().min(1).max(500)
});

const commandSchema = z.object({ profileId: z.string().min(1), command: z.string().trim().min(1).max(4096) });
const actionSchema = z.object({
  profileId: z.string().min(1),
  action: z.enum(['announce', 'save', 'kick', 'ban', 'unban', 'shutdown', 'stop']),
  payload: z.record(z.unknown()).optional()
});

const store = new ProfileStore();
const dashboardRequests = new Map<string, Promise<unknown>>();

async function getProfile(id: string): Promise<ServerProfile> {
  const profile = (await store.list()).find((item) => item.id === id);
  if (!profile) throw new Error('That server profile no longer exists.');
  if (profile.credentialError || !profile.password) throw new Error('This profile password must be re-entered. Open Settings, edit the server, and save a new password.');
  return profile;
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#111311',
    show: false,
    title: 'PalRCON',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL;
    if (!allowed || !url.startsWith(allowed)) event.preventDefault();
  });

  if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await window.loadFile(path.join(__dirname, '../../dist/index.html'));
}

function registerIpc() {
  ipcMain.handle('profiles:list', () => store.list());
  ipcMain.handle('profiles:save', (_event, input) => store.save(profileSchema.parse(input)));
  ipcMain.handle('profiles:remove', (_event, id) => store.remove(z.string().min(1).parse(id)));

  ipcMain.handle('server:test', async (_event, input) => {
    const profile = profileSchema.parse(input);
    const started = Date.now();
    const rcon = new RconClient(profile.host, profile.rconPort, profile.password);
    await rcon.probe();
    let restAvailable = false;
    let restError: string | undefined;
    if (profile.restEnabled) {
      try {
        await new PalworldRestClient(profile).info();
        restAvailable = true;
      } catch (error) {
        restError = messageFrom(error);
      }
    }
    return { rcon: true, rest: restAvailable, restError, latencyMs: Date.now() - started };
  });

  ipcMain.handle('server:dashboard', async (_event, id) => {
    const profileId = z.string().min(1).parse(id);
    const existing = dashboardRequests.get(profileId);
    if (existing) return existing;

    const request = (async () => {
      const profile = await getProfile(profileId);
      if (!profile.restEnabled) throw new Error('Enable the REST API in this server profile to load dashboard data. RCON commands run only from Console.');
      const rest = new PalworldRestClient(profile);
      const [info, players, metrics, settings] = await Promise.all([
        rest.info(), rest.players(), rest.metrics(), rest.settings()
      ]);
      return { source: 'rest', info, players: players.players ?? [], metrics, settings, refreshedAt: Date.now() };
    })();

    dashboardRequests.set(profileId, request);
    try { return await request; }
    finally { dashboardRequests.delete(profileId); }
  });

  ipcMain.handle('server:command', async (_event, input) => {
    const { profileId, command } = commandSchema.parse(input);
    const profile = await getProfile(profileId);
    return new RconClient(profile.host, profile.rconPort, profile.password).execute(command);
  });

  ipcMain.handle('server:action', async (_event, input) => {
    const { profileId, action, payload = {} } = actionSchema.parse(input);
    const profile = await getProfile(profileId);
    const text = (key: string) => z.string().trim().min(1).parse(payload[key]);
    if (!profile.restEnabled) throw new Error('This action requires the REST API. Enter RCON commands explicitly in Console.');
    const rest = new PalworldRestClient(profile);
    switch (action) {
      case 'announce':
        return rest.announce(text('message'));
      case 'save':
        return rest.save();
      case 'kick':
        return rest.kick(text('userId'), String(payload.message ?? ''));
      case 'ban':
        return rest.ban(text('userId'), String(payload.message ?? ''));
      case 'unban':
        return rest.unban(text('userId'));
      case 'shutdown': {
        const seconds = z.number().int().min(1).max(86400).parse(payload.seconds);
        const message = text('message');
        return rest.shutdown(seconds, message);
      }
      case 'stop':
        return rest.stop();
    }
  });
}

app.whenReady().then(() => {
  registerIpc();
  void createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
