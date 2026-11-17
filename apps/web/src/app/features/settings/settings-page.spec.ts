import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { TestTranslocoPipe } from '../auth/test-transloco.pipe';
import { ApiKeysService } from '../../core/services/api-keys.service';
import { AuthService } from '../../core/services/auth.service';
import { ConnectedAppsService } from '../../core/services/connected-apps.service';
import { ConfigService } from '../../core/config.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ErrorMessageService } from '../../core/services/error-message.service';
import { ToastService } from '../../shared/toast.service';
import { SettingsPage } from './settings-page';

describe('Settings', () => {
  const user = signal({ id: 'u1', email: 'a@test', name: 'Ada', language: 'es' as const });
  const keys = { list: vi.fn(), create: vi.fn(), revoke: vi.fn() };
  const apps = { list: vi.fn(), disconnect: vi.fn() };
  const auth = { user, updateProfile: vi.fn() };
  const confirm = { ask: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };
  const translation = { translate: (key: string) => key };
  beforeEach(async () => {
    vi.clearAllMocks();
    user.set({ id: 'u1', email: 'a@test', name: 'Ada', language: 'es' });
    keys.list.mockReturnValue(of([]));
    keys.create.mockReturnValue(of({ id: 'key-1', name: 'Laptop', key: 'tk_one_time_secret' }));
    keys.revoke.mockReturnValue(of(undefined));
    apps.list.mockReturnValue(of([]));
    apps.disconnect.mockReturnValue(of(undefined));
    auth.updateProfile.mockResolvedValue(undefined);
    confirm.ask.mockResolvedValue(false);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: ApiKeysService, useValue: keys },
        { provide: ConnectedAppsService, useValue: apps },
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: { mcpUrl: 'https://taskory.test/mcp' } },
        { provide: ConfirmService, useValue: confirm },
        { provide: ErrorMessageService, useValue: { key: (code: string) => `errors.${code}` } },
        { provide: ToastService, useValue: toast },
        { provide: TranslocoService, useValue: translation },
      ],
    })
      .overrideComponent(SettingsPage, {
        remove: {
          imports: [
            TranslocoPipe,
            (await import('../../shared/app-page-header')).AppPageHeaderComponent,
            (await import('./profile-section')).ProfileSectionComponent,
            (await import('./connect-assistant-card')).ConnectAssistantCardComponent,
            (await import('./connected-apps-section')).ConnectedAppsSectionComponent,
            (await import('./api-keys-section')).ApiKeysSectionComponent,
          ],
        },
        add: { imports: [TestTranslocoPipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
  });
  it('saves profile name and language, then announces success', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    await fixture.componentInstance.saveProfile({ name: 'Ada Lovelace', language: 'en' });
    expect(auth.updateProfile).toHaveBeenCalledWith({ name: 'Ada Lovelace', language: 'en' });
    expect(toast.success).toHaveBeenCalledWith('settings.profileSaved');
  });
  it('New key shown once', async () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.componentInstance.keyName.set('Laptop');
    await fixture.componentInstance.createKey();
    expect(fixture.componentInstance.newKey()).toBe('tk_one_time_secret');
    expect(Object.values(localStorage)).not.toContain('tk_one_time_secret');
    fixture.componentInstance.dismissKey();
    expect(fixture.componentInstance.newKey()).toBe('');
  });
  it('Revoke confirmation', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    confirm.ask.mockResolvedValueOnce(false);
    await fixture.componentInstance.revokeKey('key-1');
    expect(keys.revoke).not.toHaveBeenCalled();
  });
  it('revokes and removes a key after confirmation', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.componentInstance.keysList.set([
      { id: 'key-1', name: 'Laptop', prefix: 'tk_one', createdAt: '', lastUsedAt: null },
    ]);
    confirm.ask.mockResolvedValueOnce(true);
    await fixture.componentInstance.revokeKey('key-1');
    expect(keys.revoke).toHaveBeenCalledWith('key-1');
    expect(fixture.componentInstance.keysList()).toEqual([]);
  });
  it('translates API_KEY_LIMIT into the key limit message', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    keys.create.mockReturnValueOnce(throwError(() => ({ code: 'API_KEY_LIMIT' })));
    fixture.componentInstance.keyName.set('Laptop');
    await fixture.componentInstance.createKey();
    expect(toast.error).toHaveBeenCalledWith('settings.keyLimit');
  });
  it('keeps an assistant connected when disconnect confirmation is declined', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.componentInstance.appsList.set([
      { id: 'app-1', clientName: 'Calendar', createdAt: '', lastUsedAt: null },
    ]);
    confirm.ask.mockResolvedValueOnce(false);
    await fixture.componentInstance.disconnect('app-1');
    expect(apps.disconnect).not.toHaveBeenCalled();
    expect(fixture.componentInstance.appsList()).toHaveLength(1);
  });
  it('disconnects and removes an assistant after confirmation', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    fixture.componentInstance.appsList.set([
      { id: 'app-1', clientName: 'Calendar', createdAt: '', lastUsedAt: null },
    ]);
    confirm.ask.mockResolvedValueOnce(true);
    await fixture.componentInstance.disconnect('app-1');
    expect(apps.disconnect).toHaveBeenCalledWith('app-1');
    expect(fixture.componentInstance.appsList()).toEqual([]);
  });
  it('shows copy success and failure feedback', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    await fixture.componentInstance.copy('https://taskory.test/mcp');
    expect(toast.success).toHaveBeenCalledWith('settings.copied');
    writeText.mockRejectedValueOnce(new Error('denied'));
    await fixture.componentInstance.copy('secret');
    expect(toast.error).toHaveBeenCalledWith('settings.copyFailed');
  });
});
