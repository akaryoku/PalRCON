export interface RestConfig {
  host: string;
  restPort: number;
  password: string;
}

export class PalworldRestClient {
  private readonly baseUrl: string;
  private readonly auth: string;

  constructor(config: RestConfig) {
    const address = config.host.includes(':') && !config.host.startsWith('[') ? `[${config.host}]` : config.host;
    this.baseUrl = `http://${address}:${config.restPort}/v1/api`;
    this.auth = `Basic ${Buffer.from(`admin:${config.password}`).toString('base64')}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: this.auth,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers
        }
      });
      if (response.status === 401) throw new Error('REST authentication failed. Check the admin password.');
      if (!response.ok) throw new Error(`REST API returned ${response.status} ${response.statusText}.`);
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('REST API connection timed out after 6 seconds.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  info() { return this.request<Record<string, unknown>>('/info'); }
  players() { return this.request<{ players: Array<Record<string, unknown>> }>('/players'); }
  metrics() { return this.request<Record<string, unknown>>('/metrics'); }
  settings() { return this.request<Record<string, unknown>>('/settings'); }
  announce(message: string) { return this.request('/announce', { method: 'POST', body: JSON.stringify({ message }) }); }
  save() { return this.request('/save', { method: 'POST' }); }
  kick(userid: string, message = '') { return this.request('/kick', { method: 'POST', body: JSON.stringify({ userid, message }) }); }
  ban(userid: string, message = '') { return this.request('/ban', { method: 'POST', body: JSON.stringify({ userid, message }) }); }
  unban(userid: string) { return this.request('/unban', { method: 'POST', body: JSON.stringify({ userid }) }); }
  shutdown(waittime: number, message: string) { return this.request('/shutdown', { method: 'POST', body: JSON.stringify({ waittime, message }) }); }
  stop() { return this.request('/stop', { method: 'POST' }); }
}
