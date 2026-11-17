import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../core/services/auth.service';
import { LanguagePreferenceService } from '../core/services/language-preference.service';
import { ToastService } from './toast.service';
import { TestTranslocoPipe } from './test-transloco.pipe';
import { LanguageSwitcherComponent } from './language-switcher';

describe('Internationalization', () => {
  it('Switch language', async () => {
    let current = 'en';
    const transloco = {
      getActiveLang: () => current,
      setActiveLang: vi.fn((language: string) => (current = language)),
    };
    const auth = { isAuthenticated: () => true, updateLanguage: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: AuthService, useValue: auth },
        LanguagePreferenceService,
      ],
    })
      .overrideComponent(LanguageSwitcherComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select');
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await Promise.resolve();
    expect(transloco.setActiveLang).toHaveBeenCalledWith('es');
    expect(select.value).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(auth.updateLanguage).toHaveBeenCalledWith('es');
    expect(TestBed.inject(LanguagePreferenceService).choice()).toBe('es');
  });
  it('rolls back and shows a translated error when saving fails', async () => {
    let current = 'en';
    const toast = { error: vi.fn() };
    const transloco = {
      getActiveLang: () => current,
      setActiveLang: vi.fn((language: string) => (current = language)),
      translate: (key: string) => key,
    };
    const auth = {
      isAuthenticated: () => true,
      updateLanguage: vi.fn().mockRejectedValue(new Error('offline')),
    };
    await TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
      providers: [
        { provide: TranslocoService, useValue: transloco },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        LanguagePreferenceService,
      ],
    })
      .overrideComponent(LanguageSwitcherComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select');
    select.value = 'es';
    select.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();
    expect(current).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(toast.error).toHaveBeenCalledWith('errors.unknown');
  });
});
