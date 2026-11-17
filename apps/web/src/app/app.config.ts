import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TranslocoConfig, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { AppTranslocoLoader } from './core/transloco-loader';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';
import { ConfigService } from './core/config.service';
import { AuthService } from './core/services/auth.service';
import { LanguagePreferenceService } from './core/services/language-preference.service';
import { routes } from './app.routes';

const translocoConfig = {
  availableLangs: ['es', 'en'],
  defaultLang: 'en',
  reRenderOnLangChange: true,
  scopes: { autoPrefixKeys: false },
  prodMode: false,
} as TranslocoConfig;

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    provideRouter(routes),
    provideTransloco({ config: translocoConfig, loader: AppTranslocoLoader }),
    provideAppInitializer(() => {
      const config = inject(ConfigService);
      const auth = inject(AuthService);
      const preferences = inject(LanguagePreferenceService);
      const transloco = inject(TranslocoService);
      return (async () => {
        await config.load();
        await auth.initialize();
        const language = preferences.detect(auth.user()?.language ?? null);
        transloco.setActiveLang(language);
        document.documentElement.lang = language;
      })();
    }),
  ],
};
