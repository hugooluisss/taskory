import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';
import {
  Language,
  ReportDetail,
  ReportJob,
  ReportResult,
  ReportStyle,
  ReportStyles,
} from '../../core/models';
import { ReportsService } from '../../core/services/reports.service';
import { ConfirmService } from '../../shared/confirm.service';
import { AppIconComponent } from '../../shared/app-icon';
import { ReportProgressComponent } from './report-progress';
import { ReportResultComponent } from './report-result';

@Component({
  selector: 'app-report-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    NgIf,
    FormsModule,
    RouterLink,
    TranslocoPipe,
    AppIconComponent,
    ReportProgressComponent,
    ReportResultComponent,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'reports',
      loader: {
        en: () => fetch('assets/i18n/reports/en.json').then((r) => r.json()),
        es: () => fetch('assets/i18n/reports/es.json').then((r) => r.json()),
      },
    }),
  ],
  templateUrl: './report-detail-page.html',
  styles: ['@media print { body { background:white } }'],
})
export class ReportDetailPage {
  private reports = inject(ReportsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);
  readonly report = signal<ReportDetail | null>(null);
  readonly result = signal<ReportResult | null>(null);
  readonly qr = signal('');
  readonly styles = signal<ReportStyles | null>(null);
  readonly language = signal<Language>('en');
  readonly edited = signal<string | null>(null);
  private readonly savedPrompt = computed(() => {
    const report = this.report();
    if (!report) return '';
    if (report.style === 'custom') return report.customPrompt ?? '';
    return this.styles()?.styles.find((s) => s.id === report.style)?.prompt[report.language] ?? '';
  });
  readonly promptText = computed(() => this.edited() ?? this.savedPrompt());
  readonly error = signal('');
  private watch?: Subscription;
  private id = this.route.snapshot.paramMap.get('id')!;
  private shareKey = `taskory_report_share_${this.id}`;
  constructor() {
    this.reports.getStyles().subscribe((s) => this.styles.set(s));
    this.destroyRef.onDestroy(() => this.watch?.unsubscribe());
    this.load();
  }
  load(): void {
    this.reports.detail(this.id).subscribe((report) => {
      this.report.set(report);
      this.language.set(report.language);
      this.edited.set(null);
      this.setResult(report);
      const url = sessionStorage.getItem(this.shareKey);
      if (url && report.status === 'completed' && !this.expired) {
        sessionStorage.setItem(this.shareKey, url);
        void this.setShare(url);
      } else {
        this.qr.set('');
      }
      if (report.status === 'queued' || report.status === 'running') this.watchJob();
    });
  }
  private setResult(report: ReportDetail): void {
    if (report.status === 'completed' && report.markdown !== null)
      this.result.set({
        markdown: report.markdown,
        provider: report.provider ?? '',
        model: report.model ?? '',
        totalTokens: report.totalTokens,
        promptTokens: report.promptTokens,
        completionTokens: report.completionTokens,
        costUsd: report.costUsd,
        activityCount: report.activityCount,
      });
  }
  private watchJob(): void {
    this.watch?.unsubscribe();
    this.watch = this.reports.watchJob(this.id, { intervalMs: 2000 }).subscribe((job) => {
      if (job.status === 'completed' || job.status === 'failed') this.load();
    });
  }
  progress(report: ReportDetail): ReportJob {
    if (report.status === 'failed')
      return {
        id: report.id,
        status: 'failed',
        progress: report.progress,
        error: report.error
          ? {
              code: report.error.code,
              message: report.error.message,
              ...(report.error.chunk === null ? {} : { chunk: report.error.chunk }),
            }
          : { code: 'UNKNOWN', message: '' },
      };
    return {
      id: report.id,
      status: report.status as 'queued' | 'running',
      progress: report.progress,
    };
  }
  async setShare(url: string): Promise<void> {
    const report = this.report();
    if (!report) return;
    this.report.set({ ...report, shareUrl: url });
    this.qr.set(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
  }
  regenerate(): void {
    const style: ReportStyle =
      this.promptText() === this.savedPrompt() ? (this.report()?.style ?? 'custom') : 'custom';
    this.reports.regenerate(this.id, style, this.language(), this.promptText()).subscribe(() => {
      this.result.set(null);
      this.load();
      this.watchJob();
    });
  }
  renew(): void {
    this.reports.renewShare(this.id).subscribe(async (share) => {
      const current = this.report();
      if (current)
        this.report.set({
          ...current,
          shareExpiresAt: share.shareExpiresAt,
          shareUrl: share.shareUrl,
        });
      sessionStorage.setItem(this.shareKey, share.shareUrl);
      await this.setShare(share.shareUrl);
    });
  }
  projectNames(item: ReportDetail): string {
    return item.projects.map((project) => project.name).join(', ');
  }
  get styleLabel(): string {
    return this.transloco.translate(`reports.form.${this.report()?.style ?? 'summary'}`);
  }
  get languageLabel(): string {
    return this.transloco.translate(
      `reports.form.${this.report()?.language === 'es' ? 'spanish' : 'english'}`,
    );
  }
  print(): void {
    window.print();
  }
  get expired(): boolean {
    const expiry = this.report()?.shareExpiresAt;
    return !!expiry && new Date(expiry).getTime() <= Date.now();
  }
  async delete(): Promise<void> {
    if (
      !(await this.confirm.ask({
        title: this.transloco.translate('reports.confirm.title'),
        message: this.transloco.translate('reports.confirm.message'),
        confirmLabel: this.transloco.translate('reports.confirm.confirm'),
        cancelLabel: this.transloco.translate('reports.confirm.cancel'),
        danger: true,
      }))
    )
      return;
    this.reports.delete(this.id).subscribe(() => {
      sessionStorage.removeItem(this.shareKey);
      void this.router.navigate(['/reports']);
    });
  }
}
