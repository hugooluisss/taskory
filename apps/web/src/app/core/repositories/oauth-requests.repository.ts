import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { ConsentRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class OAuthRequestsRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  getRequest(id: string) {
    return this.http.get<ConsentRequest>(`${this.config.apiBaseUrl}/oauth/requests/${id}`);
  }
  decide(id: string, approved: boolean) {
    return this.http.post<{ redirectUrl: string; redirectUri?: string }>(
      `${this.config.apiBaseUrl}/oauth/requests/${id}/decision`,
      { approve: approved },
    );
  }
}
