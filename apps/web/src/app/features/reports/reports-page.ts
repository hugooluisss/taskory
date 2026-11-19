import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { ReportsService } from '../../core/services/reports.service';
import { AppPageHeaderComponent } from '../../shared/app-page-header';
import { AppPaginationComponent } from '../../shared/app-pagination';
import { ReportSummary } from '../../core/models';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslocoPipe, AppPageHeaderComponent, AppPaginationComponent],
  providers: [
    provideTranslocoScope({
      scope: 'reports',
      loader: {
        en: () => fetch('assets/i18n/reports/en.json').then((r) => r.json()),
        es: () => fetch('assets/i18n/reports/es.json').then((r) => r.json()),
      },
    }),
  ],
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  private reports = inject(ReportsService);
  readonly items = signal<ReportSummary[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly limit = 10;
  readonly Math = Math;
  constructor() {
    this.load(1);
  }
  names(report: ReportSummary): string {
    return report.projects.map((project) => project.name).join(', ');
  }
  load(page: number): void {
    this.reports.list(page).subscribe((result) => {
      this.items.set(result.items);
      this.page.set(result.page);
      this.total.set(result.total);
    });
  }
}
