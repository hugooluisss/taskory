import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ReportsService } from '../../core/services/reports.service';
import { ReportDetailPage } from './report-detail-page';
import { ReportResultComponent } from './report-result';
import { TestTranslocoPipe } from './test-transloco.pipe';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

describe('Report detail page', () => {
  it('loads a completed report and carries its saved prompt into the editor', async () => {
    const report = {
      id: 'r1',
      status: 'completed',
      from: '2026-01-01',
      to: '2026-01-02',
      language: 'en',
      style: 'custom',
      projects: [],
      activityCount: 1,
      provider: 'p',
      model: 'm',
      totalTokens: 3,
      costUsd: 0,
      createdAt: '',
      finishedAt: '',
      promptTokens: 1,
      completionTokens: 2,
      markdown: 'result',
      shareUrl: `https://example.test/shared/${'a'.repeat(180)}`,
      progress: { done: 1, total: 1 },
      shareExpiresAt: null,
      customPrompt: 'Focus',
    };
    await TestBed.configureTestingModule({
      imports: [ReportDetailPage],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'r1' } } } },
        { provide: Router, useValue: { getCurrentNavigation: () => null } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
        {
          provide: ReportsService,
          useValue: {
            detail: () => of(report),
            getStyles: () => of({ styles: [], customPrompt: null }),
            renderMarkdown: () => '<p>result</p>',
          },
        },
      ],
    })
      .overrideComponent(ReportDetailPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(ReportResultComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportDetailPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.report()?.id).toBe('r1');
    expect(page.result()?.markdown).toBe('result');
    expect(page.promptText()).toBe('Focus');
    expect(
      fixture.nativeElement.querySelector('select[aria-label="reports.detail.prompt"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('p / m · 3 tokens · 1 activities');
    expect(fixture.nativeElement.textContent).not.toMatch(/\{[^}]*\}/);
    expect(fixture.nativeElement.querySelector('main').classList.contains('min-w-0')).toBe(true);
    expect(fixture.nativeElement.querySelector('h1').classList.contains('break-words')).toBe(true);
    expect(fixture.nativeElement.querySelector('main > p').classList.contains('break-all')).toBe(
      true,
    );
    expect(
      fixture.nativeElement.querySelector('.activities-included a').classList.contains('break-all'),
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('textarea').classList.contains('w-full')).toBe(true);
    expect(fixture.nativeElement.querySelector('textarea').classList.contains('max-w-full')).toBe(
      true,
    );
    expect(
      [...fixture.nativeElement.querySelectorAll('button')].every((button: HTMLButtonElement) =>
        button.classList.contains('no-print'),
      ),
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('.activities-included')).not.toBeNull();
  });

  it('offers an icon-only renewal action for completed reports with expired links', async () => {
    const report = {
      id: 'r1',
      status: 'completed',
      from: '2026-01-01',
      to: '2026-01-02',
      language: 'en',
      style: 'summary',
      projects: [],
      activityCount: 0,
      provider: 'p',
      model: 'm',
      totalTokens: 0,
      costUsd: 0,
      createdAt: '',
      finishedAt: '',
      promptTokens: 0,
      completionTokens: 0,
      markdown: 'result',
      progress: { done: 0, total: 0 },
      shareExpiresAt: '2000-01-01T00:00:00Z',
    };
    await TestBed.configureTestingModule({
      imports: [ReportDetailPage],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'r1' } } } },
        { provide: Router, useValue: { getCurrentNavigation: () => null } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
        {
          provide: ReportsService,
          useValue: {
            detail: () => of(report),
            getStyles: () => of({ styles: [], customPrompt: null }),
            renderMarkdown: () => '<p>result</p>',
          },
        },
      ],
    })
      .overrideComponent(ReportDetailPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(ReportResultComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportDetailPage);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '.activities-included button',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('reports.detail.renew');
    expect(button.textContent.trim()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('reports.detail.expired');
  });

  it('renders a PNG QR image after creation', async () => {
    const report = {
      id: 'r1',
      status: 'completed',
      from: '',
      to: '',
      language: 'en',
      style: 'summary',
      projects: [],
      activityCount: 0,
      provider: '',
      model: '',
      totalTokens: 0,
      costUsd: 0,
      createdAt: '',
      finishedAt: '',
      promptTokens: 0,
      completionTokens: 0,
      markdown: null,
      progress: { done: 1, total: 1 },
      shareExpiresAt: null,
    };
    sessionStorage.setItem('taskory_report_share_r1', 'https://example.test/shared/token');
    await TestBed.configureTestingModule({
      imports: [ReportDetailPage],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'r1' } } } },
        {
          provide: Router,
          useValue: {
            getCurrentNavigation: () => ({
              extras: { state: { shareUrl: 'https://example.test/shared/token' } },
            }),
          },
        },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
        {
          provide: ReportsService,
          useValue: {
            detail: () => of(report),
            getStyles: () => of({ styles: [], customPrompt: null }),
            renderMarkdown: () => '<p>result</p>',
          },
        },
      ],
    })
      .overrideComponent(ReportDetailPage, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .overrideComponent(ReportResultComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportDetailPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const qr = fixture.nativeElement.querySelector('.activities-included img') as HTMLImageElement;
    expect(qr).not.toBeNull();
    expect(qr.src).toContain('data:image/png');
    expect(qr.getAttribute('alt')).toBe('reports.detail.qrAlt');
    expect(qr.width).toBe(240);
    expect(qr.height).toBe(240);
    expect(qr.classList.contains('max-w-full')).toBe(true);
    expect(qr.classList.contains('no-print')).toBe(false);
  });
});
