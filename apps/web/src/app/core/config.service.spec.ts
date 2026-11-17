import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

describe('Runtime API configuration', () => {
  it('defaults to /api/v1 and derives the MCP URL', () => {
    const service = TestBed.inject(ConfigService);
    expect(service.apiBaseUrl).toBe('/api/v1');
    expect(service.mcpUrl).toBe(`${window.location.origin}/mcp`);
  });
  it('loads an API base URL override from runtime config', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ apiBaseUrl: 'https://api.test/v2', mcpUrl: 'https://mcp.test/mcp' }),
      }),
    );
    const service = TestBed.inject(ConfigService);
    await service.load();
    expect(service.apiBaseUrl).toBe('https://api.test/v2');
    expect(service.mcpUrl).toBe('https://mcp.test/mcp');
    vi.unstubAllGlobals();
  });
});
