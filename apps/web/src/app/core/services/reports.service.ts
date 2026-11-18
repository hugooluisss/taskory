import { SecurityContext, Injectable, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import {
  EMPTY,
  Observable,
  SchedulerLike,
  concatMap,
  defer,
  expand,
  of,
  retry,
  switchMap,
  takeWhile,
  throwError,
  timer,
} from 'rxjs';
import { ReportJob, ReportRequest, ReportResult, ReportStyles } from '../models';
import { ReportsRepository } from '../repositories/reports.repository';
import { REPORT_SCHEDULER } from './report-scheduler';
import { ReportCreationResult } from './reports.repository-result';

export interface DateRange {
  from: string;
  to: string;
}

export interface ReportPresets {
  thisWeek: DateRange;
  lastWeek: DateRange;
  thisMonth: DateRange;
  lastMonth: DateRange;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private repository = inject(ReportsRepository);
  private sanitizer = inject(DomSanitizer);
  private scheduler = inject(REPORT_SCHEDULER);
  getStyles(): Observable<ReportStyles> {
    return this.repository.getStyles();
  }
  presets(now = new Date()): ReportPresets {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (date.getDay() + 6) % 7;
    const thisMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
    const lastMonday = new Date(
      thisMonday.getFullYear(),
      thisMonday.getMonth(),
      thisMonday.getDate() - 7,
    );
    const sunday = new Date(
      thisMonday.getFullYear(),
      thisMonday.getMonth(),
      thisMonday.getDate() + 6,
    );
    const lastSunday = new Date(
      thisMonday.getFullYear(),
      thisMonday.getMonth(),
      thisMonday.getDate() - 1,
    );
    return {
      thisWeek: this.range(thisMonday, sunday),
      lastWeek: this.range(lastMonday, lastSunday),
      thisMonth: this.range(
        new Date(date.getFullYear(), date.getMonth(), 1),
        new Date(date.getFullYear(), date.getMonth() + 1, 0),
      ),
      lastMonth: this.range(
        new Date(date.getFullYear(), date.getMonth() - 1, 1),
        new Date(date.getFullYear(), date.getMonth(), 0),
      ),
    };
  }
  validateRange(from: string, to: string): void {
    if (!this.isCalendarDate(from) || !this.isCalendarDate(to) || from > to) {
      throw new RangeError('Report dates must be calendar dates in ascending order.');
    }
  }
  create(request: ReportRequest): Observable<ReportCreationResult> {
    this.validateRange(request.from, request.to);
    return this.repository.create(request).pipe(
      concatMap((response) => {
        if (response.status === 202) {
          return of<ReportCreationResult>({ kind: 'job', job: response.body as ReportJob });
        }
        if (response.status === 200) {
          return of<ReportCreationResult>({ kind: 'done', report: response.body as ReportResult });
        }
        return throwError(() => new Error(`Unexpected report response status ${response.status}.`));
      }),
    );
  }
  watchJob(
    id: string,
    options: { intervalMs: number; scheduler?: SchedulerLike },
  ): Observable<ReportJob> {
    const scheduler = options.scheduler ?? this.scheduler;
    const poll = () =>
      this.repository.getJob(id).pipe(
        retry({
          count: 4,
          delay: (error: unknown, retryCount: number) => {
            const status = this.statusOf(error);
            if (status !== 0) return throwError(() => error);
            return timer(options.intervalMs * 2 ** retryCount, scheduler);
          },
        }),
      );
    return defer(poll).pipe(
      expand((job) => {
        if (job.status === 'completed' || job.status === 'failed') return EMPTY;
        return timer(options.intervalMs, scheduler).pipe(switchMap(poll));
      }),
      takeWhile((job) => job.status !== 'completed' && job.status !== 'failed', true),
    );
  }
  retry(id: string) {
    return this.repository.retryJob(id);
  }
  delete(id: string) {
    return this.repository.deleteJob(id);
  }
  renderMarkdown(markdown: string): string {
    const html = marked.parse(markdown, { async: false });
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
    const document = new DOMParser().parseFromString(sanitized, 'text/html');
    document.querySelectorAll('a').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    document
      .querySelectorAll('img')
      .forEach((image) => image.replaceWith(document.createTextNode(image.alt)));
    return document.body.innerHTML.replace(/\s+href="unsafe:(?:javascript|data):[^"]*"/gi, '');
  }
  async copyMarkdown(markdown: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(markdown);
        return;
      } catch {
        this.copyWithDocument(markdown);
        return;
      }
    }
    this.copyWithDocument(markdown);
  }
  private copyWithDocument(markdown: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = markdown;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('The browser could not copy the report.');
  }
  private isCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }
  private statusOf(error: unknown): number {
    if (typeof error !== 'object' || error === null || !('status' in error)) return -1;
    return Number(error.status);
  }
  private range(from: Date, to: Date): DateRange {
    return { from: this.formatDate(from), to: this.formatDate(to) };
  }
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
