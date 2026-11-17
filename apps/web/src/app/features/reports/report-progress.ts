import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReportJob } from '../../core/models';
import { AppButtonComponent } from '../../shared/app-button';

@Component({
  selector: 'app-report-progress',
  standalone: true,
  imports: [TranslocoPipe, AppButtonComponent],
  templateUrl: './report-progress.html',
  styleUrl: './report-progress.css',
})
export class ReportProgressComponent {
  @Input({ required: true }) job!: ReportJob;
  @Input() active = true;
  @Output() retry = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  get percent(): number {
    return this.job.progress.total
      ? Math.floor((this.job.progress.done / this.job.progress.total) * 100)
      : 0;
  }
  get announce(): boolean {
    return (
      (this.job.status !== 'running' && this.job.status !== 'queued') || this.percent % 10 === 0
    );
  }
}
