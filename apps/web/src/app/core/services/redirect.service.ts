import { Inject, Injectable, InjectionToken } from '@angular/core';

export const LOCATION_ASSIGN = new InjectionToken<(url: string) => void>('LOCATION_ASSIGN', {
  providedIn: 'root',
  factory: () => (url) => window.location.assign(url),
});

@Injectable({ providedIn: 'root' })
export class RedirectService {
  constructor(@Inject(LOCATION_ASSIGN) private navigate: (url: string) => void) {}
  assign(url: string): void {
    this.navigate(url);
  }
}
