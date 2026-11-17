import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppIconComponent } from './app-icon';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../core/services/auth.service';
import { Language } from '../core/models';
import { LanguagePreferenceService } from '../core/services/language-preference.service';
import { ErrorMessageService } from '../core/services/error-message.service';
import { ApiError } from '../core/api-error';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [TranslocoPipe, AppIconComponent],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcherComponent {
  private transloco = inject(TranslocoService);
  private auth = inject(AuthService);
  private preference = inject(LanguagePreferenceService);
  private errors = inject(ErrorMessageService);
  private toast = inject(ToastService);
  private saving: Promise<void> = Promise.resolve();
  private confirmedLanguage: Language | null = null;
  private latestChange = 0;
  get activeLanguage(): string {
    return this.transloco.getActiveLang();
  }
  change(event: Event): void {
    const language = (event.target as HTMLSelectElement).value as Language;
    const previousLanguage = this.transloco.getActiveLang() as Language;
    this.confirmedLanguage ??= previousLanguage;
    this.preference.save(language);
    this.transloco.setActiveLang(language);
    document.documentElement.lang = language;
    if (!this.auth.isAuthenticated()) return;
    const change = ++this.latestChange;
    this.saving = this.saving.then(async () => {
      try {
        await this.auth.updateLanguage(language);
        this.confirmedLanguage = language;
      } catch (error) {
        if (change !== this.latestChange) return;
        const rollback = this.confirmedLanguage ?? previousLanguage;
        this.preference.save(rollback);
        this.transloco.setActiveLang(rollback);
        document.documentElement.lang = rollback;
        this.toast.error(
          this.transloco.translate(
            this.errors.key(error instanceof ApiError ? error.code : undefined),
          ),
        );
      }
    });
  }
}
