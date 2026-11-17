import { TestBed } from '@angular/core/testing';
import { LanguagePreferenceService } from './language-preference.service';

describe('Internationalization', () => {
  it('uses API language before saved, browser, then English', () => {
    const service = TestBed.inject(LanguagePreferenceService);
    service.save('en');
    expect(service.detect('es')).toBe('es');
    expect(service.detect(null)).toBe('en');
    service.save('es');
    expect(service.detect(null)).toBe('es');
    service.save(null);
    vi.stubGlobal('navigator', { language: 'es-MX' });
    expect(service.detect(null)).toBe('es');
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(service.detect(null)).toBe('en');
    vi.unstubAllGlobals();
  });
});
