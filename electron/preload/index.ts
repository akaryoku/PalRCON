import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('palrcon', {
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    save: (profile: unknown) => ipcRenderer.invoke('profiles:save', profile),
    remove: (id: string) => ipcRenderer.invoke('profiles:remove', id)
  },
  server: {
    test: (profile: unknown) => ipcRenderer.invoke('server:test', profile),
    dashboard: (profileId: string) => ipcRenderer.invoke('server:dashboard', profileId),
    command: (profileId: string, command: string) => ipcRenderer.invoke('server:command', { profileId, command }),
    action: (profileId: string, action: string, payload?: Record<string, unknown>) => ipcRenderer.invoke('server:action', { profileId, action, payload })
  }
});
