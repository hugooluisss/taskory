import { LocalPathService } from './local-path.service';

describe('Access', () => {
  it('keeps only single-slash local paths as return URLs', () => {
    const service = new LocalPathService();
    expect(service.normalize('/oauth/consent?request=r1')).toBe('/oauth/consent?request=r1');
    for (const value of [
      '//evil.test/path',
      '\\\\evil.test',
      'https://evil.test',
      'javascript:alert(1)',
      '/path\nnext',
    ]) {
      expect(service.normalize(value)).toBe('/activities');
    }
  });
});
