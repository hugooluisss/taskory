import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ReportsService } from '../../core/services/reports.service';
import { ActivitiesService } from '../../core/services/activities.service';
import { ReportFormComponent } from './report-form';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Report generation', () => {
  const reports = {
    presets: vi.fn(() => ({
      thisWeek: { from: '2026-11-16', to: '2026-11-22' },
      lastWeek: { from: '2026-11-09', to: '2026-11-15' },
      thisMonth: { from: '2026-11-01', to: '2026-11-30' },
      lastMonth: { from: '2026-10-01', to: '2026-10-31' },
    })),
    providers: vi.fn(() => of([{ id: 'local', defaultModel: 'm1', available: false }])),
    validateRange: vi.fn((from: string, to: string) => {
      if (from > to) throw new RangeError();
    }),
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ReportFormComponent],
      providers: [
        { provide: ReportsService, useValue: reports },
        {
          provide: ActivitiesService,
          useValue: { meta: () => of({ projects: ['Apollo'], tags: [] }) },
        },
        { provide: AuthService, useValue: { user: () => ({ language: 'es' }) } },
      ],
    })
      .overrideComponent(ReportFormComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
  });
  it('uses fixed report presets and the user language', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.from()).toBe('2026-11-16');
    expect(fixture.componentInstance.language()).toBe('es');
    fixture.componentInstance.selectPreset('lastMonth');
    expect(fixture.componentInstance.to()).toBe('2026-10-31');
  });
  it('rejects an inverted range without generating', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    const emit = vi.spyOn(fixture.componentInstance.generate, 'emit');
    fixture.componentInstance.from.set('2026-11-25');
    fixture.componentInstance.to.set('2026-11-01');
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.rangeError()).toBe(true);
    expect(emit).not.toHaveBeenCalled();
  });
  it('disables an unavailable provider in Advanced settings', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.advanced-toggle').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('option[value="local"]').disabled).toBe(true);
  });
  it('offers project suggestions from activity metadata', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#report-projects option').value).toBe('Apollo');
  });
});
