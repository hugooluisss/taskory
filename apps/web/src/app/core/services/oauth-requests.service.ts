import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OAuthRequestsRepository } from '../repositories/oauth-requests.repository';

export interface OAuthDecision {
  redirectUrl: string;
}

@Injectable({ providedIn: 'root' })
export class OAuthRequestsService {
  private repository = inject(OAuthRequestsRepository);
  getRequest(id: string) {
    return this.repository.getRequest(id);
  }
  async decide(id: string, approve: boolean): Promise<OAuthDecision> {
    const result = await firstValueFrom(this.repository.decide(id, approve));
    const redirectUrl = result.redirectUrl ?? result.redirectUri;
    if (!redirectUrl || !this.isSafeRedirect(redirectUrl)) {
      throw new TypeError('The authorization server returned an unsafe redirect URL.');
    }
    return { redirectUrl };
  }
  private isSafeRedirect(value: string): boolean {
    if (/^(javascript|data|file):/i.test(value)) return false;
    const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1].toLowerCase();
    if (!scheme) return false;
    if (scheme !== 'http' && scheme !== 'https') return true;
    try {
      return new URL(value).host.length > 0;
    } catch {
      return false;
    }
  }
}
