import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReportJob } from '../../core/models';
import { ReportProgressComponent } from './report-progress';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Long report progress', () => {
  it('exposes determinate progress and restrained announcements', async () => {
    await TestBed.configureTestingModule({ imports: [ReportProgressComponent] })
      .overrideComponent(ReportProgressComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportProgressComponent);
    fixture.componentInstance.job = {
      id: 'r1',
      status: 'running',
      progress: { done: 2, total: 10 },
    };
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('10');
    expect(fixture.nativeElement.querySelector('p').getAttribute('aria-live')).toBe('polite');
    fixture.componentRef.setInput('job', {
      ...fixture.componentInstance.job,
      progress: { done: 1, total: 9 },
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),
    ).toBe('1');
    expect(fixture.nativeElement.querySelector('p').getAttribute('aria-live')).toBe('off');
  });
  it('Failed job', async () => {
    await TestBed.configureTestingModule({ imports: [ReportProgressComponent] })
      .overrideComponent(ReportProgressComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportProgressComponent);
    fixture.componentInstance.job = {
      id: 'r1',
      status: 'failed',
      progress: { done: 2, total: 4 },
      error: { code: 'LLM_UNAVAILABLE', message: 'failed', chunk: 3 },
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('reports.progress.failed');
    expect(fixture.componentInstance.job.error?.chunk).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('app-button').length).toBe(2);
  });
});
