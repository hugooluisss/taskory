import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { Language, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  register(body: { email: string; password: string; name: string }) {
    return this.http.post<{ token: string; user: User }>(
      `${this.config.apiBaseUrl}/auth/register`,
      body,
    );
  }
  login(body: { email: string; password: string }) {
    return this.http.post<{ token: string; user: User }>(
      `${this.config.apiBaseUrl}/auth/login`,
      body,
    );
  }
  me() {
    return this.http.get<User>(`${this.config.apiBaseUrl}/auth/me`);
  }
  updateMe(body: { name?: string; language?: Language }) {
    return this.http.patch<User>(`${this.config.apiBaseUrl}/auth/me`, body);
  }
}
