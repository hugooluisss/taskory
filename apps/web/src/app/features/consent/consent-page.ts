import { Component, inject, InjectionToken, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ConsentRequest } from '../../core/models';
import { OAuthRequestsService } from '../../core/services/oauth-requests.service';
import { RedirectService } from '../../core/services/redirect.service';
import { ConsentRedirectService } from './consent-redirect.service';
import { ConsentDetailsComponent } from './consent-details';
import { AppIconComponent } from '../../shared/app-icon';

export const CONSENT_WINDOW = new InjectionToken<Pick<Window, 'top' | 'self'>>('CONSENT_WINDOW', {
  providedIn: 'root',
  factory: () => window,
});

@Component({
  selector: 'app-consent-page',
  standalone: true,
  imports: [NgIf, RouterLink, TranslocoPipe, ConsentDetailsComponent, AppIconComponent],
  providers: [
    provideTranslocoScope({
      scope: 'consent',
      loader: {
        en: () => import('../../../../public/assets/i18n/consent/en.json'),
        es: () => import('../../../../public/assets/i18n/consent/es.json'),
      },
    }),
  ],
  templateUrl: './consent-page.html',
})
export class ConsentPage {
  private browser = inject(CONSENT_WINDOW);
  private route = inject(ActivatedRoute);
  private requests = inject(OAuthRequestsService);
  private redirect = inject(RedirectService);
  private redirectPolicy = inject(ConsentRedirectService);
  readonly framed = signal(this.browser.top !== this.browser.self);
  readonly request = signal<ConsentRequest | null>(null);
  readonly unavailable = signal(false);
  readonly error = signal(false);
  readonly loading = signal(false);
  readonly lastDecision = signal<boolean | null>(null);
  private id = this.route.snapshot.queryParamMap.get('request') ?? '';
  constructor() {
    if (!this.framed()) void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    this.unavailable.set(false);
    try {
      this.request.set(await firstValueFrom(this.requests.getRequest(this.id)));
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 410) this.unavailable.set(true);
      else this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  async decide(approve: boolean): Promise<void> {
    const request = this.request();
    if (!request || this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.lastDecision.set(approve);
    try {
      const result = await this.requests.decide(this.id, approve);
      if (!this.redirectPolicy.allows(result.redirectUrl, request.redirectUri))
        throw new TypeError('Unsafe redirect');
      this.redirect.assign(result.redirectUrl);
    } catch (error) {
      if ([404, 410].includes((error as { status?: number }).status ?? 0)) {
        this.request.set(null);
        this.unavailable.set(true);
      } else this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
