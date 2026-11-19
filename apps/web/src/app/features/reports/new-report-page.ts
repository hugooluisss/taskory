import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ReportRequest } from '../../core/models';
import { ReportsService } from '../../core/services/reports.service';
import { ReportFormComponent } from './report-form';
@Component({
  selector: 'app-new-report-page',
  standalone: true,
  imports: [ReportFormComponent],
  template:
    '<main class="mx-auto max-w-5xl px-4 py-6"><app-report-form (generate)="generate($event)" /></main>',
})
export class NewReportPage {
  private reports = inject(ReportsService);
  private router = inject(Router);
  generate(request: ReportRequest): void {
    this.reports.create(request).subscribe((result) => {
      const report = result.kind === 'job' ? result.job : result.report;
      const shareUrl = 'shareUrl' in report ? report.shareUrl : undefined;
      if (shareUrl) sessionStorage.setItem(`taskory_report_share_${report.id}`, shareUrl);
      void this.router.navigate(['/reports', report.id]);
    });
  }
}
