import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { ApiError } from '../api-error';
import { User } from '../models';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthService } from './auth.service';
import { LanguagePreferenceService } from './language-preference.service';

describe('AuthService', () => {
  const user = { id: 'u1', email: 'a@b.test', name: 'Ada', language: 'es' } as User;
  const repository = {
    me: vi.fn(() => of(user)),
    login: vi.fn(() => of({ token: 'jwt', user })),
    register: vi.fn(() => of({ token: 'jwt', user })),
    updateMe: vi.fn(() => of({ ...user, language: 'en' })),
  };
  const transloco = { setActiveLang: vi.fn() };
  let service: AuthService;
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    repository.me.mockReturnValue(of(user));
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: TranslocoService, useValue: transloco },
        LanguagePreferenceService,
      ],
    });
    service = TestBed.inject(AuthService);
  });
  it('logs in and persists the token with the API user', async () => {
    await service.login('a@b.test', 'password1');
    expect(service.token()).toBe('jwt');
    expect(service.user()).toEqual(user);
    expect(localStorage.getItem('taskory_token')).toBe('jwt');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('es');
  });
  it('registers and stores the new session', async () => {
    await service.register('a@b.test', 'password1', 'Ada');
    expect(service.isAuthenticated()).toBe(true);
  });
  it('loads the profile at startup when a token exists', async () => {
    localStorage.setItem('taskory_token', 'jwt');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: TranslocoService, useValue: transloco },
        LanguagePreferenceService,
      ],
    });
    service = TestBed.inject(AuthService);
    await service.init();
    expect(repository.me).toHaveBeenCalled();
    expect(service.user()).toEqual(user);
  });
  it('clears an expired session after a 401', async () => {
    localStorage.setItem('taskory_token', 'expired');
    repository.me.mockReturnValueOnce(throwError(() => new ApiError('UNAUTHORIZED', 401)));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: TranslocoService, useValue: transloco },
        LanguagePreferenceService,
      ],
    });
    service = TestBed.inject(AuthService);
    await service.init();
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('taskory_token')).toBeNull();
  });
  it('updates the profile language immediately through the API', async () => {
    await service.updateLanguage('en');
    expect(repository.updateMe).toHaveBeenCalledWith({ language: 'en' });
    expect(document.documentElement.lang).toBe('en');
    expect(transloco.setActiveLang).toHaveBeenCalledWith('en');
  });
  describe('Settings', () => {
    it('updates a name only and keeps the existing language', async () => {
      document.documentElement.lang = 'es';
      service.user.set(user);
      repository.updateMe.mockReturnValueOnce(of({ ...user, name: 'Ada Lovelace' }));
      await service.updateProfile({ name: 'Ada Lovelace' });
      expect(repository.updateMe).toHaveBeenCalledWith({ name: 'Ada Lovelace' });
      expect(service.user()?.name).toBe('Ada Lovelace');
      expect(document.documentElement.lang).not.toBe('en');
    });
    it('updates and persists a language only', async () => {
      service.user.set(user);
      repository.updateMe.mockReturnValueOnce(of({ ...user, language: 'en' }));
      await service.updateProfile({ language: 'en' });
      expect(repository.updateMe).toHaveBeenCalledWith({ language: 'en' });
      expect(service.user()?.language).toBe('en');
      expect(TestBed.inject(LanguagePreferenceService).choice()).toBe('en');
      expect(transloco.setActiveLang).toHaveBeenCalledWith('en');
      expect(document.documentElement.lang).toBe('en');
    });
    it('updates name and language together', async () => {
      service.user.set(user);
      repository.updateMe.mockReturnValueOnce(
        of({ ...user, name: 'Ada Lovelace', language: 'en' }),
      );
      await service.updateProfile({ name: 'Ada Lovelace', language: 'en' });
      expect(repository.updateMe).toHaveBeenCalledWith({ name: 'Ada Lovelace', language: 'en' });
      expect(service.user()).toEqual({ ...user, name: 'Ada Lovelace', language: 'en' });
      expect(document.documentElement.lang).toBe('en');
    });
    it('leaves the current user unchanged when profile saving fails', async () => {
      service.user.set(user);
      repository.updateMe.mockReturnValueOnce(throwError(() => new ApiError('NETWORK_ERROR', 0)));
      await expect(service.updateProfile({ name: 'Grace' })).rejects.toBeInstanceOf(ApiError);
      expect(service.user()).toEqual(user);
    });
  });
  it('keeps the token and propagates non-401 profile errors', async () => {
    localStorage.setItem('taskory_token', 'valid');
    repository.me.mockReturnValueOnce(throwError(() => new ApiError('NETWORK_ERROR', 0)));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: TranslocoService, useValue: transloco },
        LanguagePreferenceService,
      ],
    });
    service = TestBed.inject(AuthService);
    await expect(service.init()).rejects.toBeInstanceOf(ApiError);
    expect(service.token()).toBe('valid');
  });
  it('survives blocked local storage while updating the in-memory session', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const ephemeral = TestBed.inject(AuthService);
    await ephemeral.login('a@b.test', 'password1');
    expect(ephemeral.token()).toBe('jwt');
    expect(ephemeral.isAuthenticated()).toBe(true);
    vi.restoreAllMocks();
  });
  it('clears the session on logout', async () => {
    await service.login('a@b.test', 'password1');
    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('taskory_token')).toBeNull();
  });
});
