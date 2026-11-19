import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import {
  Paginated,
  ReportDetail,
  ReportJob,
  ReportRequest,
  ReportResult,
  ReportStyles,
  ReportSummary,
  RetryReportJob,
  SharedReport,
  ReportStyle,
  Language,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ReportsRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  create(body: ReportRequest) {
    return this.http.post<ReportResult | ReportJob>(`${this.config.apiBaseUrl}/reports`, body, {
      observe: 'response' as const,
    });
  }
  getStyles() {
    return this.http.get<ReportStyles>(`${this.config.apiBaseUrl}/reports/styles`);
  }
  getJob(id: string) {
    return this.http.get<ReportJob>(`${this.config.apiBaseUrl}/reports/${id}`);
  }
  getDetail(id: string) {
    return this.http.get<ReportDetail>(`${this.config.apiBaseUrl}/reports/${id}`);
  }
  list(page: number, limit = 10) {
    return this.http.get<Paginated<ReportSummary>>(`${this.config.apiBaseUrl}/reports`, {
      params: { page, limit },
    });
  }
  regenerate(id: string, body: { style: ReportStyle; customPrompt?: string; language?: Language }) {
    return this.http.post<RetryReportJob>(
      `${this.config.apiBaseUrl}/reports/${id}/regenerate`,
      body,
    );
  }
  renewShare(id: string) {
    return this.http.post<{ shareUrl: string; shareExpiresAt: string }>(
      `${this.config.apiBaseUrl}/reports/${id}/share/renew`,
      {},
    );
  }
  getShared(token: string) {
    return this.http.get<SharedReport>(
      `${this.config.apiBaseUrl}/shared/${encodeURIComponent(token)}`,
    );
  }
  retryJob(id: string) {
    return this.http.post<RetryReportJob>(`${this.config.apiBaseUrl}/reports/${id}/retry`, {});
  }
  deleteJob(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/reports/${id}`);
  }
}
