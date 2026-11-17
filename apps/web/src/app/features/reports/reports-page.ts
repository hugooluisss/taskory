import { Component, DestroyRef, ViewChild, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { ReportJob, ReportRequest, ReportResult } from '../../core/models';
import { ApiError } from '../../core/api-error';
import { ReportsService } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../shared/confirm.service';
import { AppPageHeaderComponent } from '../../shared/app-page-header';
import { ReportFormComponent } from './report-form';
import { ReportProgressComponent } from './report-progress';
import { ReportResultComponent } from './report-result';
import { AppIconComponent } from '../../shared/app-icon';

const JOB_KEY = 'taskory_report_job_';

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [
    TranslocoPipe,
    AppPageHeaderComponent,
    ReportFormComponent,
    ReportProgressComponent,
    ReportResultComponent,
    AppIconComponent,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'reports',
      loader: {
        en: () => fetch('assets/i18n/reports/en.json').then((response) => response.json()),
        es: () => fetch('assets/i18n/reports/es.json').then((response) => response.json()),
      },
    }),
  ],
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  private reports = inject(ReportsService);
  private auth = inject(AuthService);
  private transloco = inject(TranslocoService);
  private confirm = inject(ConfirmService);
  private destroyRef = inject(DestroyRef);
  @ViewChild(ReportFormComponent) form?: ReportFormComponent;
  readonly result = signal<ReportResult | null>(null);
  readonly job = signal<ReportJob | null>(null);
  readonly errorKey = signal('');
  readonly activeReportId = signal('');
  private watch?: Subscription;
  private userKey(): string | null {
    const userId = this.auth.user()?.id;
    return userId ? `${JOB_KEY}${userId}` : null;
  }
  constructor() {
    this.destroyRef.onDestroy(() => this.watch?.unsubscribe());
    this.resume();
  }
  generate(request: ReportRequest): void {
    this.result.set(null);
    this.errorKey.set('');
    this.activeReportId.set('');
    this.reports.create(request).subscribe({
      next: (response) => {
        if (response.kind === 'done') {
          this.result.set(response.report);
          this.form?.finish();
        } else {
          this.job.set(response.job);
          this.storeJob(response.job.id);
          this.watchJob(response.job.id);
        }
      },
      error: (error) => this.handleError(error),
    });
  }
  retry(): void {
    const job = this.job();
    if (!job) return;
    this.reports.retry(job.id).subscribe({
      next: (result) => {
        this.job.set({ ...result });
        this.storeJob(result.id);
        this.watchJob(result.id);
      },
      error: (error) => this.handleError(error),
    });
  }
  openActiveReport(): void {
    const id = this.activeReportId();
    if (!id) return;
    this.activeReportId.set('');
    this.errorKey.set('');
    this.result.set(null);
    this.job.set(null);
    this.storeJob(id);
    this.watchJob(id);
  }
  async deleteJob(): Promise<void> {
    const job = this.job();
    if (
      !job ||
      !(await this.confirm.ask({
        title: this.transloco.translate('reports.confirm.title'),
        message: this.transloco.translate('reports.confirm.message'),
        confirmLabel: this.transloco.translate('reports.confirm.confirm'),
        cancelLabel: this.transloco.translate('reports.confirm.cancel'),
        danger: true,
      }))
    )
      return;
    this.watch?.unsubscribe();
    this.reports
      .delete(job.id)
      .subscribe({ next: () => this.clearJob(), error: (error) => this.handleError(error) });
  }
  private resume(): void {
    const key = this.userKey();
    if (!key) return;
    try {
      const id = localStorage.getItem(key);
      if (id) this.watchJob(id);
    } catch {
      /* Storage can be disabled by the browser. */
    }
  }
  private storeJob(id: string): void {
    const key = this.userKey();
    try {
      if (key) localStorage.setItem(key, id);
    } catch {
      /* Storage can be disabled by the browser. */
    }
  }
  private clearJob(): void {
    const key = this.userKey();
    try {
      if (key) localStorage.removeItem(key);
    } catch {
      /* Storage can be disabled by the browser. */
    }
    this.job.set(null);
  }
  private watchJob(id: string): void {
    this.watch?.unsubscribe();
    this.watch = this.reports.watchJob(id, { intervalMs: 2000 }).subscribe({
      next: (job) => {
        this.job.set(job);
        if (job.status === 'completed') {
          this.result.set({
            markdown: job.markdown ?? '',
            provider: job.provider,
            model: job.model,
            activityCount: job.activityCount,
          });
          this.clearJob();
          this.form?.finish();
        }
        if (job.status === 'failed') {
          this.clearStoredJob();
          this.form?.finish();
        }
      },
      error: (error) => {
        if ((error as { status?: number }).status === 404) this.clearJob();
        else this.handleError(error);
      },
    });
  }
  private clearStoredJob(): void {
    const key = this.userKey();
    try {
      if (key) localStorage.removeItem(key);
    } catch {
      /* Storage can be disabled by the browser. */
    }
  }
  private handleError(error: unknown): void {
    const code = error instanceof ApiError ? error.code : (error as { code?: string })?.code;
    const key = `reports.errors.${code && ['NO_ACTIVITIES', 'RANGE_TOO_LARGE', 'LLM_UNAVAILABLE', 'UNKNOWN_PROVIDER', 'REPORT_IN_PROGRESS', 'VALIDATION_ERROR'].includes(code) ? code : 'UNKNOWN'}`;
    this.errorKey.set(key);
    const activeId = error instanceof ApiError ? error.details['id'] : undefined;
    this.activeReportId.set(
      code === 'REPORT_IN_PROGRESS' && typeof activeId === 'string' ? activeId : '',
    );
    this.form?.finish();
  }
}
