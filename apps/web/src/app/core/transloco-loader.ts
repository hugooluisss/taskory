import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslocoLoader } from '@jsverse/transloco';
@Injectable({ providedIn: 'root' })
export class AppTranslocoLoader implements TranslocoLoader {
  private http = inject(HttpClient);
  getTranslation(lang: string) {
    return this.http.get<Record<string, unknown>>(`assets/i18n/${lang}.json`);
  }
}
