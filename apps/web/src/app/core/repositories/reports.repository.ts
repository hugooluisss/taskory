import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { ReportJob, ReportRequest, ReportResult, ReportStyles, RetryReportJob } from '../models';

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
  retryJob(id: string) {
    return this.http.post<RetryReportJob>(`${this.config.apiBaseUrl}/reports/${id}/retry`, {});
  }
  deleteJob(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/reports/${id}`);
  }
}
