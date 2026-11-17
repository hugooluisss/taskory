import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { ProviderInfo, ReportJob, ReportRequest, ReportResult, RetryReportJob } from '../models';

@Injectable({ providedIn: 'root' })
export class ReportsRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  providers() {
    return this.http.get<ProviderInfo[]>(`${this.config.apiBaseUrl}/reports/providers`);
  }
  create(body: ReportRequest) {
    return this.http.post<ReportResult | ReportJob>(`${this.config.apiBaseUrl}/reports`, body, {
      observe: 'response' as const,
    });
  }
  getJob(id: string) {
    return this.http.get<ReportJob>(`${this.config.apiBaseUrl}/reports/${id}`);
  }
  retryJob(id: string) {
    return this.http.post<RetryReportJob>(`${this.config.apiBaseUrl}/reports/${id}/retry`, {});
  }
  deleteJob(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/reports/${id}`);
  }
}
