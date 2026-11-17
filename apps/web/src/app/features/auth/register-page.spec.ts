import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { ErrorMessageService } from '../../core/services/error-message.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher';
import { RegisterPage } from './register-page';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Access', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let auth: { register: ReturnType<typeof vi.fn> };
  let router: Router;
  let returnUrl: string | null = null;
  beforeEach(async () => {
    returnUrl = null;
    auth = { register: vi.fn().mockResolvedValue(undefined) };
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ErrorMessageService, useValue: { key: (code: string) => `errors.${code}` } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => returnUrl } } },
        },
      ],
    })
      .overrideComponent(RegisterPage, {
        remove: { imports: [TranslocoPipe, LanguageSwitcherComponent] },
        add: { imports: [TestTranslocoPipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
  });
  it('shows required and password-length validation before submitting', async () => {
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('auth.required');
    expect(fixture.nativeElement.textContent).toContain('auth.emailInvalid');
    expect(fixture.nativeElement.textContent).toContain('auth.passwordLength');
    expect(auth.register).not.toHaveBeenCalled();
  });
  it('shows a translated API error and preserves entered values', async () => {
    auth.register.mockRejectedValueOnce({ code: 'EMAIL_TAKEN' });
    fixture.componentInstance.form.setValue({
      name: 'Ada',
      email: 'ada@example.test',
      password: 'password1',
    });
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'errors.EMAIL_TAKEN',
    );
    expect(fixture.componentInstance.form.value.name).toBe('Ada');
  });
  it('disables the register button while registration is pending', async () => {
    let resolveRegistration!: () => void;
    auth.register.mockReturnValueOnce(
      new Promise<void>((resolve) => (resolveRegistration = resolve)),
    );
    fixture.componentInstance.form.setValue({
      name: 'Ada',
      email: 'ada@example.test',
      password: 'password1',
    });
    const submission = fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    resolveRegistration();
    await submission;
  });
  it('redirects to activities when no returnUrl is provided', async () => {
    fixture.componentInstance.form.setValue({
      name: 'Ada',
      email: 'ada@example.test',
      password: 'password1',
    });
    await fixture.componentInstance.submit();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/activities');
  });
  it('preserves returnUrl in the login link and rejects absolute return URLs', async () => {
    returnUrl = '/oauth/consent?request=req1';
    fixture.destroy();
    fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toContain(
      'returnUrl=%2Foauth%2Fconsent%3Frequest%3Dreq1',
    );
    returnUrl = 'https://evil.test/path';
    fixture.componentInstance.form.setValue({
      name: 'Ada',
      email: 'ada@example.test',
      password: 'password1',
    });
    await fixture.componentInstance.submit();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/activities');
  });
});
