import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api-error';
import { Language, User } from '../models';
import { AuthRepository } from '../repositories/auth.repository';
import { LanguagePreferenceService } from './language-preference.service';

const TOKEN_KEY = 'taskory_token';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private repository = inject(AuthRepository);
  private transloco = inject(TranslocoService);
  private preference = inject(LanguagePreferenceService);
  readonly user = signal<User | null>(null);
  readonly token = signal<string | null>(this.readToken());
  readonly isAuthenticated = computed(() => !!this.token());
  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  private saveToken(token: string | null): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* Browser storage may be disabled. */
    }
    this.token.set(token);
  }
  async init(): Promise<void> {
    if (!this.token()) return;
    try {
      const user = await firstValueFrom(this.repository.me());
      this.setUser(user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) this.logout();
      else throw error;
    }
  }
  initialize(): Promise<void> {
    return this.init();
  }
  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(this.repository.login({ email, password }));
    this.saveToken(result.token);
    this.setUser(result.user);
  }
  async register(email: string, password: string, name: string): Promise<void> {
    const result = await firstValueFrom(this.repository.register({ email, password, name }));
    this.saveToken(result.token);
    this.setUser(result.user);
  }
  logout(): void {
    this.saveToken(null);
    this.user.set(null);
  }
  async updateLanguage(language: Language): Promise<void> {
    await this.updateProfile({ language });
  }
  async updateProfile(changes: { name?: string; language?: Language }): Promise<void> {
    const user = await firstValueFrom(this.repository.updateMe(changes));
    if (changes.language) {
      this.preference.save(changes.language);
      this.transloco.setActiveLang(changes.language);
      document.documentElement.lang = changes.language;
    }
    this.user.set(user);
  }
  private setUser(user: User): void {
    this.user.set(user);
    this.transloco.setActiveLang(user.language);
    document.documentElement.lang = user.language;
  }
}
