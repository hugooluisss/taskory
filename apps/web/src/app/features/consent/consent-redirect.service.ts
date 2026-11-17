import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConsentRedirectService {
  allows(target: string, registered: string): boolean {
    try {
      const targetUrl = new URL(target);
      const registeredUrl = new URL(registered);
      return (
        targetUrl.protocol === registeredUrl.protocol &&
        targetUrl.hostname === registeredUrl.hostname &&
        targetUrl.port === registeredUrl.port &&
        targetUrl.pathname === registeredUrl.pathname &&
        !['javascript:', 'data:', 'file:'].includes(targetUrl.protocol)
      );
    } catch {
      return false;
    }
  }
}
