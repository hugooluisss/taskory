import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoPipe } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ReportsService } from '../../core/services/reports.service';
import { SharedReportPage } from './shared-report-page';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Shared report page', () => {
  it('loads only the public activity snapshot and adopts its language', () => {
    const data = {
      period: { from: '2026-01-01', to: '2026-01-02' },
      language: 'es',
      projects: ['A'],
      activities: [],
    };
    const language = { setActiveLang: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SharedReportPage],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'token' } } } },
        { provide: ReportsService, useValue: { shared: vi.fn(() => of(data)) } },
        { provide: TranslocoService, useValue: language },
      ],
    }).overrideComponent(SharedReportPage, {
      remove: { imports: [TranslocoPipe] },
      add: { imports: [TestTranslocoPipe] },
    });
    const fixture = TestBed.createComponent(SharedReportPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.data()).toEqual(data);
    expect(page.state()).toBe('ready');
    expect(language.setActiveLang).toHaveBeenCalledWith('es');
    expect(fixture.nativeElement.textContent).toContain('reports.shared.title');
    expect(fixture.nativeElement.textContent).not.toContain(' · ');
    expect(fixture.nativeElement.textContent).not.toMatch(/\{[^}]*\}/);
  });

  it('shows project and tag badges without dangling separators', async () => {
    const data = {
      period: { from: '2026-01-01', to: '2026-01-02' },
      language: 'en',
      projects: [],
      activities: [
        {
          date: '2026-01-01',
          title: 'Work',
          description: 'plain text',
          projects: [],
          tags: ['focus'],
          referenceUrls: [],
        },
      ],
    };
    await TestBed.configureTestingModule({
      imports: [SharedReportPage],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'token' } } } },
        { provide: ReportsService, useValue: { shared: () => of(data) } },
        { provide: TranslocoService, useValue: { setActiveLang: vi.fn() } },
      ],
    })
      .overrideComponent(SharedReportPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(SharedReportPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.badge')?.textContent).toContain('focus');
    expect(fixture.nativeElement.textContent).not.toContain(' · ');
    expect(fixture.nativeElement.textContent).not.toMatch(/\{[^}]*\}/);
  });
});
