import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('palrcon', {
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    save: (profile: unknown) => ipcRenderer.invoke('profiles:save', profile),
    remove: (id: string) => ipcRenderer.invoke('profiles:remove', id),
    export: () => ipcRenderer.invoke('profiles:export'),
    import: () => ipcRenderer.invoke('profiles:import')
  },
  server: {
    test: (profile: unknown) => ipcRenderer.invoke('server:test', profile),
    dashboard: (profileId: string) => ipcRenderer.invoke('server:dashboard', profileId),
    command: (profileId: string, command: string) => ipcRenderer.invoke('server:command', { profileId, command }),
    action: (profileId: string, action: string, payload?: Record<string, unknown>) => ipcRenderer.invoke('server:action', { profileId, action, payload }),
    diagnostics: (profileId: string) => ipcRenderer.invoke('server:diagnostics', profileId)
  },
  preferences: {
    get: () => ipcRenderer.invoke('preferences:get'),
    set: (value: unknown) => ipcRenderer.invoke('preferences:set', value)
  },
  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    open: () => ipcRenderer.invoke('updates:open')
  },
  clipboard: { write: (value: string) => ipcRenderer.invoke('clipboard:write', value) },
  logs: { export: (entries: unknown) => ipcRenderer.invoke('logs:export', entries) },
  automations: {
    list: () => ipcRenderer.invoke('automations:list'),
    save: (value: unknown) => ipcRenderer.invoke('automations:save', value),
    remove: (id: string) => ipcRenderer.invoke('automations:remove', id),
    setEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('automations:enabled', { id, enabled }),
    runNow: (id: string) => ipcRenderer.invoke('automations:run', id),
    onResult: (callback: (value: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);
      ipcRenderer.on('automations:result', listener);
      return () => ipcRenderer.removeListener('automations:result', listener);
    }
  }
});
