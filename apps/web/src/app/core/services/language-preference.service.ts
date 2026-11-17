import { Injectable, signal } from '@angular/core';
import { Language } from '../models';

@Injectable({ providedIn: 'root' })
export class LanguagePreferenceService {
  readonly choice = signal<Language | null>(null);
  save(language: Language | null): void {
    this.choice.set(language);
  }
  detect(apiLanguage: Language | null): Language {
    return (
      apiLanguage ??
      this.choice() ??
      (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en')
    );
  }
}
