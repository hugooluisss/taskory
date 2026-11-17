import { Component, inject, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ApiKey, ConnectedApp, Language } from '../../core/models';
import { ConfigService } from '../../core/config.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiKeysService } from '../../core/services/api-keys.service';
import { ConnectedAppsService } from '../../core/services/connected-apps.service';
import { ErrorMessageService } from '../../core/services/error-message.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { AppPageHeaderComponent } from '../../shared/app-page-header';
import { ProfileSectionComponent } from './profile-section';
import { ConnectAssistantCardComponent } from './connect-assistant-card';
import { ConnectedAppsSectionComponent } from './connected-apps-section';
import { ApiKeysSectionComponent } from './api-keys-section';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    TranslocoPipe,
    AppPageHeaderComponent,
    ProfileSectionComponent,
    ConnectAssistantCardComponent,
    ConnectedAppsSectionComponent,
    ApiKeysSectionComponent,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'settings',
      loader: {
        en: () => import('../../../../public/assets/i18n/settings/en.json'),
        es: () => import('../../../../public/assets/i18n/settings/es.json'),
      },
    }),
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  private auth = inject(AuthService);
  private keys = inject(ApiKeysService);
  private apps = inject(ConnectedAppsService);
  private config = inject(ConfigService);
  private confirm = inject(ConfirmService);
  private errors = inject(ErrorMessageService);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  readonly user = this.auth.user;
  readonly keysList = signal<ApiKey[]>([]);
  readonly appsList = signal<ConnectedApp[]>([]);
  readonly keyName = signal('');
  readonly newKey = signal('');
  readonly loading = signal(false);
  readonly savingProfile = signal(false);
  readonly creatingKey = signal(false);
  readonly mcpUrl = this.config.mcpUrl;
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [keys, apps] = await Promise.all([
        firstValueFrom(this.keys.list()),
        firstValueFrom(this.apps.list()),
      ]);
      this.keysList.set(keys);
      this.appsList.set(apps);
    } catch (error) {
      this.showError(error);
    } finally {
      this.loading.set(false);
    }
  }
  async saveProfile(changes: { name: string; language: Language }): Promise<void> {
    this.savingProfile.set(true);
    try {
      await this.auth.updateProfile(changes);
      this.toast.success(this.translate('settings.profileSaved'));
    } catch (error) {
      this.showError(error);
    } finally {
      this.savingProfile.set(false);
    }
  }
  async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.toast.success(this.translate('settings.copied'));
    } catch {
      this.toast.error(this.translate('settings.copyFailed'));
    }
  }
  async createKey(): Promise<void> {
    this.creatingKey.set(true);
    try {
      const result = await firstValueFrom(this.keys.create(this.keyName()));
      this.newKey.set(result.key);
      this.keyName.set('');
      this.keysList.update((items) => [
        {
          id: result.id,
          name: result.name,
          prefix: result.key.slice(0, 8),
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
        ...items,
      ]);
    } catch (error) {
      if ((error as { code?: string }).code === 'API_KEY_LIMIT')
        this.toast.error(this.translate('settings.keyLimit'));
      else this.showError(error);
    } finally {
      this.creatingKey.set(false);
    }
  }
  dismissKey(): void {
    this.newKey.set('');
  }
  async revokeKey(id: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.translate('settings.revokeTitle'),
      message: this.translate('settings.revokeMessage'),
      confirmLabel: this.translate('settings.revoke'),
      cancelLabel: this.translate('settings.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await firstValueFrom(this.keys.revoke(id));
      this.keysList.update((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      this.showError(error);
    }
  }
  async disconnect(id: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.translate('settings.disconnectTitle'),
      message: this.translate('settings.disconnectMessage'),
      confirmLabel: this.translate('settings.disconnect'),
      cancelLabel: this.translate('settings.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    try {
      await firstValueFrom(this.apps.disconnect(id));
      this.appsList.update((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      this.showError(error);
    }
  }
  private translate(key: string): string {
    return this.transloco.translate(key);
  }
  private showError(error: unknown): void {
    this.toast.error(this.translate(this.errors.key((error as { code?: string }).code)));
  }
}
