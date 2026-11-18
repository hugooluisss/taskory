import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { TestScheduler } from 'rxjs/testing';
import { asyncScheduler } from 'rxjs';
import { defer, of, throwError } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { ReportJob } from '../models';
import { ReportsRepository } from '../repositories/reports.repository';
import { REPORT_SCHEDULER } from './report-scheduler';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const pending = { id: 'j', status: 'running' } as ReportJob;
  const completed = { id: 'j', status: 'completed' } as ReportJob;
  const repository = {
    create: vi.fn(() => of(new HttpResponse({ status: 200, body: { markdown: 'done' } }))),
    getJob: vi.fn(() => of(completed)),
    retryJob: vi.fn(() => of(completed)),
    deleteJob: vi.fn(() => of(undefined)),
  };
  let service: ReportsService;
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: repository },
        { provide: REPORT_SCHEDULER, useValue: asyncScheduler },
      ],
    });
    service = TestBed.inject(ReportsService);
  });
  it('builds week and month presets in local calendar dates', () => {
    expect(service.presets(new Date(2026, 10, 18))).toEqual({
      thisWeek: { from: '2026-11-16', to: '2026-11-22' },
      lastWeek: { from: '2026-11-09', to: '2026-11-15' },
      thisMonth: { from: '2026-11-01', to: '2026-11-30' },
      lastMonth: { from: '2026-10-01', to: '2026-10-31' },
    });
  });
  it('rejects invalid and inverted report date ranges', () => {
    expect(() => service.validateRange('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => service.validateRange('2026-02-02', '2026-02-01')).toThrow(RangeError);
    expect(() => service.validateRange('bad', '2026-02-01')).toThrow(RangeError);
  });
  it('returns a done result for HTTP 200', () => {
    repository.create.mockReturnValueOnce(
      of(
        new HttpResponse({
          status: 200,
          body: {
            markdown: 'm',
            provider: 'p',
            model: 'm',
            promptTokens: 1,
            completionTokens: 2,
            totalTokens: 3,
            costUsd: 0,
            activityCount: 1,
          },
        }),
      ),
    );
    let result: unknown;
    service
      .create({ from: '2026-01-01', to: '2026-01-02', language: 'en' })
      .subscribe((value) => (result = value));
    expect(result).toEqual({
      kind: 'done',
      report: {
        markdown: 'm',
        provider: 'p',
        model: 'm',
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
        costUsd: 0,
        activityCount: 1,
      },
    });
  });
  it('returns a job result for HTTP 202', () => {
    const job = { id: 'j', status: 'queued' } as ReportJob;
    repository.create.mockReturnValueOnce(
      of(new HttpResponse({ status: 202, body: job })) as never,
    );
    let result: unknown;
    service
      .create({ from: '2026-01-01', to: '2026-01-02', language: 'en' })
      .subscribe((value) => (result = value));
    expect(result).toEqual({ kind: 'job', job });
  });
  it('polls until a job is terminal and completes', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: repository },
        { provide: REPORT_SCHEDULER, useValue: scheduler },
      ],
    });
    service = TestBed.inject(ReportsService);
    repository.getJob.mockReturnValueOnce(of(pending)).mockReturnValueOnce(of(completed));
    const values: ReportJob[] = [];
    service.watchJob('j', { intervalMs: 10 }).subscribe((value) => values.push(value));
    scheduler.flush();
    expect(values).toEqual([pending, completed]);
  });
  it('stops polling when the subscriber unsubscribes', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    repository.getJob.mockReturnValue(of(pending));
    const subscription = service.watchJob('j', { intervalMs: 10, scheduler }).subscribe();
    scheduler.schedule(() => subscription.unsubscribe(), 25);
    scheduler.flush();
    expect(repository.getJob).toHaveBeenCalledTimes(3);
  });
  it('backs off and retries a network polling error', () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    let attempts = 0;
    repository.getJob.mockReturnValueOnce(
      defer(() => (++attempts === 1 ? throwError(() => ({ status: 0 })) : of(completed))),
    );
    const values: ReportJob[] = [];
    const subscription = service
      .watchJob('j', { intervalMs: 100, scheduler })
      .subscribe((value) => values.push(value));
    expect(repository.getJob).toHaveBeenCalledTimes(1);
    scheduler.flush();
    expect(repository.getJob).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(2);
    expect(values).toEqual([completed]);
    subscription.unsubscribe();
  });
  it('Safe rendering sanitizes scripts, event handlers and javascript links', () => {
    const html = service.renderMarkdown(
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<a href="javascript:alert(1)">bad</a>',
    );
    expect(html).not.toMatch(/<script|onerror|javascript:/i);
  });
  it('copies markdown using the clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await service.copyMarkdown('notes');
    expect(writeText).toHaveBeenCalledWith('notes');
    vi.unstubAllGlobals();
  });
  it('copies markdown with the document fallback when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    await service.copyMarkdown('notes');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    vi.unstubAllGlobals();
  });
  it('delegates retries and deletes to the repository', () => {
    service.retry('j').subscribe();
    service.delete('j').subscribe();
    expect(repository.retryJob).toHaveBeenCalledWith('j');
    expect(repository.deleteJob).toHaveBeenCalledWith('j');
  });
});
