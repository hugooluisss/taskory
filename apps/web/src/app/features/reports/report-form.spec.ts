import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ReportsService } from '../../core/services/reports.service';
import { ProjectsService } from '../../core/services/projects.service';
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
          provide: ProjectsService,
          useValue: {
            list: () =>
              of([
                { id: 'p1', name: 'Apollo', archived: false },
                { id: 'p2', name: 'Zeus', archived: false },
                { id: 'p3', name: 'Old', archived: true },
              ]),
          },
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
  it('selects all non-archived projects by default', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Apollo');
    expect(fixture.componentInstance.selectedProjects()).toEqual(['p1', 'p2']);
    expect(fixture.nativeElement.textContent).not.toContain('Old');
  });
  it('toggles a project button', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.detectChanges();
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item: HTMLButtonElement) => item.textContent.trim() === 'Apollo',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedProjects()).toEqual(['p2']);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
  it('omits projectIds when all projects are selected', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    const emit = vi.spyOn(fixture.componentInstance.generate, 'emit');
    fixture.componentInstance.submit();
    expect(emit.mock.calls[0]![0]!.projectIds).toBeUndefined();
  });
  it('sends selected project ids when only some are selected', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    const emit = vi.spyOn(fixture.componentInstance.generate, 'emit');
    fixture.componentInstance.selectedProjects.set(['p2']);
    fixture.componentInstance.submit();
    expect(emit.mock.calls[0]![0]!.projectIds).toEqual(['p2']);
  });
  it('blocks submission when no project is selected', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    const emit = vi.spyOn(fixture.componentInstance.generate, 'emit');
    fixture.componentInstance.selectedProjects.set([]);
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.componentInstance.projectError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(emit).not.toHaveBeenCalled();
  });
  it('allows submission without project ids when the user has no projects', () => {
    TestBed.overrideProvider(ProjectsService, { useValue: { list: () => of([]) } });
    const fixture = TestBed.createComponent(ReportFormComponent);
    const emit = vi.spyOn(fixture.componentInstance.generate, 'emit');
    fixture.detectChanges();
    fixture.componentInstance.submit();
    expect(fixture.nativeElement.textContent).toContain('projects.empty');
    expect(emit.mock.calls[0]![0]!.projectIds).toBeUndefined();
  });
});
