import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { ConnectedApp } from '../models';

@Injectable({ providedIn: 'root' })
export class ConnectedAppsRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  list() {
    return this.http.get<ConnectedApp[]>(`${this.config.apiBaseUrl}/connected-apps`);
  }
  disconnect(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/connected-apps/${id}`);
  }
}
