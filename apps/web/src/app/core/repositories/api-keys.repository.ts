import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { ApiKey } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiKeysRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  list() {
    return this.http.get<ApiKey[]>(`${this.config.apiBaseUrl}/api-keys`);
  }
  create(name: string) {
    return this.http.post<{ id: string; name: string; key: string }>(
      `${this.config.apiBaseUrl}/api-keys`,
      { name },
    );
  }
  revoke(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/api-keys/${id}`);
  }
}
