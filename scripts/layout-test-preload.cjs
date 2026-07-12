const { contextBridge } = require('electron');

const profile = { id: 'layout-test', name: 'Layout Test', host: '127.0.0.1', rconPort: 25575, restPort: 8212, restEnabled: false, password: 'test' };
contextBridge.exposeInMainWorld('palrcon', {
  profiles: { list: async () => [profile], save: async () => [profile], remove: async () => [], export: async () => ({ canceled: true }), import: async () => ({ canceled: true, count: 0, profiles: [profile] }) },
  server: { dashboard: async () => ({}), command: async () => '', action: async () => ({}), diagnostics: async () => ({}) },
  preferences: { get: async () => ({ checkForUpdatesOnStartup: false }), set: async (value) => value },
  updates: { check: async () => ({}), open: async () => undefined },
  clipboard: { write: async () => undefined },
  logs: { export: async () => ({ canceled: true }) },
  automations: { list: async () => [], save: async () => [], remove: async () => [], setEnabled: async () => [], runNow: async () => ({}), onResult: () => () => undefined }
});
