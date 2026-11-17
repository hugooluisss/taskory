import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { authGuard } from '../../core/guards/auth.guard';
import { AuthService } from '../../core/services/auth.service';
import { OAuthRequestsService } from '../../core/services/oauth-requests.service';
import { RedirectService } from '../../core/services/redirect.service';
import { CONSENT_WINDOW, ConsentPage } from './consent-page';
import { ConsentDetailsComponent } from './consent-details';

describe('Agent connection and consent', () => {
  const request = {
    clientName: 'Calendar app',
    clientId: 'client-123',
    redirectUri: 'https://client.test/return?source=taskory',
    redirectHost: 'client.test',
    scope: 'activities reports',
    accessDescription: 'full-access',
    expiresAt: '2026-11-17T12:00:00Z',
  };
  const requests = { getRequest: vi.fn(), decide: vi.fn() };
  const redirect = { assign: vi.fn() };
  beforeEach(async () => {
    vi.clearAllMocks();
    requests.getRequest.mockReturnValue(of(request));
    await TestBed.configureTestingModule({
      imports: [ConsentPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => false } },
        { provide: OAuthRequestsService, useValue: requests },
        { provide: RedirectService, useValue: redirect },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => 'req1' } } },
        },
      ],
    })
      .overrideComponent(ConsentPage, {
        remove: { imports: [TranslocoPipe, ConsentDetailsComponent] },
        add: { imports: [TestTranslocoPipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
  });
  async function createPage(): Promise<ComponentFixture<ConsentPage>> {
    const fixture = TestBed.createComponent(ConsentPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  async function decideFromButton(approve: boolean): Promise<void> {
    const fixture = await createPage();
    requests.decide.mockResolvedValueOnce({ redirectUrl: 'https://client.test/return?code=abc' });
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[approve ? 0 : 1].click();
    await fixture.whenStable();
    expect(requests.decide).toHaveBeenCalledWith('req1', approve);
    expect(redirect.assign).toHaveBeenCalledWith('https://client.test/return?code=abc');
  }
  it('Approve', () => decideFromButton(true));
  it('Deny', () => decideFromButton(false));
  it.each(['javascript:alert(1)', 'data:text/html,evil', 'file:///etc/passwd'])(
    'rejects unsafe redirect %s',
    async (target) => {
      const fixture = await createPage();
      requests.decide.mockResolvedValueOnce({ redirectUrl: target });
      await fixture.componentInstance.decide(true);
      expect(redirect.assign).not.toHaveBeenCalled();
      expect(fixture.componentInstance.error()).toBe(true);
    },
  );
  it('allows a registered custom redirect scheme', async () => {
    const fixture = await createPage();
    fixture.componentInstance.request.set({
      ...request,
      redirectUri: 'taskory-agent://authorize/return',
    });
    requests.decide.mockResolvedValueOnce({
      redirectUrl: 'taskory-agent://authorize/return?code=abc',
    });
    await fixture.componentInstance.decide(true);
    expect(redirect.assign).toHaveBeenCalledWith('taskory-agent://authorize/return?code=abc');
  });
  it('refuses framed display without loading the request or showing decisions', () => {
    TestBed.overrideProvider(CONSENT_WINDOW, {
      useValue: { top: {} as Window, self: {} as Window },
    });
    const fixture = TestBed.createComponent(ConsentPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.framed()).toBe(true);
    expect(requests.getRequest).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
  it.each([404, 410])('Expired request (%i)', async (status) => {
    requests.getRequest.mockReturnValueOnce(throwError(() => ({ status })));
    const fixture = TestBed.createComponent(ConsentPage);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.componentInstance.unavailable()).toBe(true);
    expect(fixture.nativeElement.querySelector('a[routerLink="/activities"]')).toBeTruthy();
  });
  it('shows a retry after a decision has expired', async () => {
    const fixture = await createPage();
    requests.decide.mockRejectedValueOnce({ status: 404 });
    await fixture.componentInstance.decide(true);
    expect(fixture.componentInstance.request()).toBeNull();
    expect(fixture.componentInstance.unavailable()).toBe(true);
  });
  it('keeps a clear heading hierarchy and named decision buttons', async () => {
    const fixture = await createPage();
    expect(fixture.nativeElement.querySelectorAll('h1')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('h2')).toHaveLength(0);
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent.trim())).toEqual([
      'consent.allow',
      'consent.deny',
    ]);
  });
  it('offers a retry after a decision network error', async () => {
    const fixture = await createPage();
    requests.decide.mockRejectedValueOnce({ status: 0 });
    await fixture.componentInstance.decide(true);
    expect(fixture.componentInstance.error()).toBe(true);
    requests.decide.mockResolvedValueOnce({ redirectUrl: 'https://client.test/return?code=retry' });
    await fixture.componentInstance.decide(true);
    expect(redirect.assign).toHaveBeenCalledWith('https://client.test/return?code=retry');
  });
  it('shows a retry after a network error', async () => {
    requests.getRequest.mockReturnValueOnce(throwError(() => ({ status: 0 })));
    const fixture = TestBed.createComponent(ConsentPage);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe(true);
    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });
  it('Login in the middle of authorization', () => {
    const auth = { isAuthenticated: () => false };
    TestBed.overrideProvider(AuthService, { useValue: auth });
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/oauth/consent?request=req1' } as never),
    );
    expect(router.serializeUrl(result as never)).toContain(
      encodeURIComponent('/oauth/consent?request=req1'),
    );
  });
});
