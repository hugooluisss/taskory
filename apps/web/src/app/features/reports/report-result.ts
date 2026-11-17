import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ReportResult } from '../../core/models';
import { ReportsService } from '../../core/services/reports.service';
import { ToastService } from '../../shared/toast.service';
import { AppIconComponent } from '../../shared/app-icon';
import { AppButtonComponent } from '../../shared/app-button';

@Component({
  selector: 'app-report-result',
  standalone: true,
  imports: [TranslocoPipe, AppButtonComponent, AppIconComponent],
  templateUrl: './report-result.html',
  styleUrl: './report-result.css',
})
export class ReportResultComponent {
  private reports = inject(ReportsService);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  @Input({ required: true }) report!: ReportResult;
  @Output() delete = new EventEmitter<void>();
  readonly copying = signal(false);
  get html(): string {
    return this.reports.renderMarkdown(this.report.markdown);
  }
  async copy(): Promise<void> {
    this.copying.set(true);
    try {
      await this.reports.copyMarkdown(this.report.markdown);
      this.toast.success(this.transloco.translate('reports.result.copied'));
    } catch {
      this.toast.error(this.transloco.translate('reports.result.copyFailed'));
    } finally {
      this.copying.set(false);
    }
  }
}
