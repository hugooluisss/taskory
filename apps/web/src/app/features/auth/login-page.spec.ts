import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { ErrorMessageService } from '../../core/services/error-message.service';
import { LoginPage } from './login-page';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Access', () => {
  let fixture: ComponentFixture<LoginPage>;
  let auth: { login: ReturnType<typeof vi.fn> };
  let router: Router;
  let returnUrl: string | null = '/reports?from=today';
  beforeEach(async () => {
    returnUrl = '/reports?from=today';
    auth = { login: vi.fn().mockResolvedValue(undefined) };
    await TestBed.configureTestingModule({
      imports: [LoginPage],
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
      .overrideComponent(LoginPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });
  it('Wrong credentials', async () => {
    auth.login.mockRejectedValueOnce({ code: 'INVALID_CREDENTIALS' });
    fixture.componentInstance.form.setValue({ email: 'bad@example.test', password: 'wrong' });
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'errors.INVALID_CREDENTIALS',
    );
  });
  it('rejects hostile return paths', async () => {
    returnUrl = '//evil.test/path';
    fixture.componentInstance.form.setValue({ email: 'ada@example.test', password: 'password1' });
    await fixture.componentInstance.submit();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/activities');
  });
  it('shows validation messages and does not submit invalid fields', async () => {
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[aria-live="polite"]').length).toBeGreaterThan(
      0,
    );
    expect(auth.login).not.toHaveBeenCalled();
  });
  it('disables submit while login is pending and returns to returnUrl', async () => {
    let resolveLogin!: () => void;
    auth.login.mockReturnValueOnce(new Promise<void>((resolve) => (resolveLogin = resolve)));
    fixture.componentInstance.form.setValue({ email: 'ada@example.test', password: 'password1' });
    const submission = fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    resolveLogin();
    await submission;
    expect(router.navigateByUrl).toHaveBeenCalledWith('/reports?from=today');
  });
  it('does not show the language switcher on the login screen', () => {
    expect(fixture.nativeElement.querySelector('app-language-switcher')).toBeNull();
  });
});
