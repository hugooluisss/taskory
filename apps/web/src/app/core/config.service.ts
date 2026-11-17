import { Injectable, signal } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl: string;
  mcpUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  readonly config = signal<RuntimeConfig>({ apiBaseUrl: '/api/v1', mcpUrl: '' });
  async load(): Promise<void> {
    const response = await fetch('/assets/config.json');
    if (!response.ok) return;
    const override = (await response.json()) as Partial<RuntimeConfig>;
    this.config.set({ ...this.config(), ...override });
  }
  get apiBaseUrl(): string {
    return this.config().apiBaseUrl;
  }
  get mcpUrl(): string {
    return this.config().mcpUrl || `${window.location.origin}/mcp`;
  }
}
