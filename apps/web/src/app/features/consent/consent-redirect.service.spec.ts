import { ConsentRedirectService } from './consent-redirect.service';

describe('Consent redirect validation', () => {
  const service = new ConsentRedirectService();
  const registered = 'https://client.test:8443/return';

  it('allows API query parameters on the registered destination', () => {
    expect(service.allows(`${registered}?code=abc&state=xyz`, registered)).toBe(true);
  });

  it.each([
    'https://evil.test:8443/return?code=abc',
    'https://client.test/return?code=abc',
    'https://client.test:8443/other?code=abc',
    'http://client.test:8443/return?code=abc',
  ])('rejects a redirect with a different host, port, path or scheme: %s', (target) => {
    expect(service.allows(target, registered)).toBe(false);
  });
});
