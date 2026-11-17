import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { ReportJob } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ActivitiesService } from '../../core/services/activities.service';
import { ReportsService } from '../../core/services/reports.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ReportsPage } from './reports-page';
import { ReportFormComponent } from './report-form';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Long report progress', () => {
  let progress: Subject<any>;
  const reports = {
    presets: vi.fn(() => ({
      thisWeek: { from: '2026-11-16', to: '2026-11-22' },
      lastWeek: { from: '2026-11-09', to: '2026-11-15' },
      thisMonth: { from: '2026-11-01', to: '2026-11-30' },
      lastMonth: { from: '2026-10-01', to: '2026-10-31' },
    })),
    providers: vi.fn(() => of([])),
    validateRange: vi.fn(),
    create: vi.fn(() =>
      of({ kind: 'done', report: { markdown: 'r', provider: 'p', model: 'm', activityCount: 1 } }),
    ),
    watchJob: vi.fn(() => progress.asObservable()),
    retry: vi.fn(() => of({ id: 'job-1', status: 'running', progress: { done: 0, total: 2 } })),
    delete: vi.fn(() => of(undefined)),
  };
  beforeEach(async () => {
    localStorage.clear();
    progress = new Subject();
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: ActivitiesService, useValue: { meta: () => of({ projects: [], tags: [] }) } },
        { provide: AuthService, useValue: { user: () => ({ id: 'user-1', language: 'en' }) } },
        { provide: ConfirmService, useValue: { ask: vi.fn(() => Promise.resolve(true)) } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    })
      .overrideComponent(ReportsPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(ReportFormComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
  });
  it('resumes the saved job on return and stops watching on destroy', () => {
    localStorage.setItem('taskory_report_job_user-1', 'job-1');
    const stop = vi.fn();
    reports.watchJob.mockReturnValueOnce(
      new Observable((subscriber) => {
        subscriber.next({ id: 'job-1', status: 'running', progress: { done: 0, total: 2 } });
        return stop;
      }),
    );
    const fixture = TestBed.createComponent(ReportsPage);
    expect(reports.watchJob).toHaveBeenCalledWith('job-1', { intervalMs: 2000 });
    expect(fixture.componentInstance.job()?.status).toBe('running');
    fixture.destroy();
    expect(stop).toHaveBeenCalled();
  });
  it('clears a saved job when the API says it no longer exists', () => {
    localStorage.setItem('taskory_report_job_user-1', 'gone');
    reports.watchJob.mockReturnValueOnce(throwError(() => ({ status: 404 })) as Observable<any>);
    TestBed.createComponent(ReportsPage);
    expect(localStorage.getItem('taskory_report_job_user-1')).toBeNull();
  });
  it('No activities', () => {
    reports.create.mockReturnValueOnce(throwError(() => new ApiError('NO_ACTIVITIES', 422)));
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.detectChanges();
    fixture.componentInstance.generate({ from: '2026-01-01', to: '2026-01-02', language: 'en' });
    expect(fixture.componentInstance.errorKey()).toBe('reports.errors.NO_ACTIVITIES');
  });
  it('opens and watches the active report from a 409 response', () => {
    reports.create.mockReturnValueOnce(
      throwError(() => new ApiError('REPORT_IN_PROGRESS', 409, { id: 'active-9' })),
    );
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.detectChanges();
    fixture.componentInstance.generate({ from: '2026-01-01', to: '2026-01-02', language: 'en' });
    fixture.detectChanges();
    expect(fixture.componentInstance.errorKey()).toBe('reports.errors.REPORT_IN_PROGRESS');
    expect(fixture.nativeElement.querySelector('.open-report').textContent).toContain(
      'reports.errors.openActiveReport',
    );
    fixture.nativeElement.querySelector('.open-report').click();
    expect(reports.watchJob).toHaveBeenCalledWith('active-9', { intervalMs: 2000 });
    expect(localStorage.getItem('taskory_report_job_user-1')).toBe('active-9');
  });
  it('retries a failed report and watches the restarted job', () => {
    const fixture = TestBed.createComponent(ReportsPage);
    fixture.componentInstance.job.set({
      id: 'job-1',
      status: 'failed',
      progress: { done: 1, total: 2 },
      error: { code: 'LLM_UNAVAILABLE', chunk: 2 },
    } as ReportJob);
    fixture.componentInstance.retry();
    expect(reports.retry).toHaveBeenCalledWith('job-1');
    expect(reports.watchJob).toHaveBeenCalledWith('job-1', { intervalMs: 2000 });
  });
});
