import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ReportsService } from '../../core/services/reports.service';
import { ProjectsService } from '../../core/services/projects.service';
import { AuthService } from '../../core/services/auth.service';
import { NewReportPage } from './new-report-page';

describe('New report flow', () => {
  it('navigates to the created report and keeps its one-time share URL in session storage', () => {
    sessionStorage.clear();
    localStorage.removeItem('taskory_report_share_r1');
    const navigate = vi.fn();
    const request = { from: '2026-01-01', to: '2026-01-02', language: 'en' as const };
    TestBed.configureTestingModule({
      imports: [NewReportPage],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            create: () =>
              of({ kind: 'done', report: { id: 'r1', shareUrl: 'https://site/shared/x' } }),
            presets: () => ({
              thisWeek: { from: '2026-01-01', to: '2026-01-07' },
              lastWeek: { from: '', to: '' },
              thisMonth: { from: '', to: '' },
              lastMonth: { from: '', to: '' },
            }),
            getStyles: () => of({ styles: [], customPrompt: null }),
            validateRange: () => undefined,
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: ProjectsService, useValue: { list: () => of([]) } },
        { provide: AuthService, useValue: { user: () => ({ language: 'en' }) } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
    TestBed.createComponent(NewReportPage).componentInstance.generate(request);
    expect(navigate).toHaveBeenCalledWith(['/reports', 'r1']);
    expect(sessionStorage.getItem('taskory_report_share_r1')).toBe('https://site/shared/x');
    expect(localStorage.getItem('taskory_report_share_r1')).toBeNull();
  });
});
