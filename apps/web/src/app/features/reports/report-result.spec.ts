import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ReportsService } from '../../core/services/reports.service';
import { ReportsRepository } from '../../core/repositories/reports.repository';
import { ToastService } from '../../shared/toast.service';
import { ReportResultComponent } from './report-result';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Report generation', () => {
  it('Safe rendering', async () => {
    const toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ReportResultComponent],
      providers: [
        { provide: ReportsRepository, useValue: {} },
        { provide: ToastService, useValue: toast },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    })
      .overrideComponent(ReportResultComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const reports = TestBed.inject(ReportsService);
    vi.spyOn(reports, 'copyMarkdown').mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(ReportResultComponent);
    fixture.componentInstance.report = {
      markdown:
        '[external](https://outside.test)\n\n![private image](https://outside.test/image.png)\n\n<script>alert(1)</script>',
      provider: 'p',
      model: 'm',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: 0.0123,
      activityCount: 1,
    };
    const sanitizerWarning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fixture.detectChanges();
    sanitizerWarning.mockRestore();
    expect(fixture.componentInstance.formattedCost).toBe('US$0.0123');
    const article: HTMLElement = fixture.nativeElement.querySelector('.markdown');
    expect(article.classList.contains('min-w-0')).toBe(true);
    expect(article.className).toContain('overflow-x-auto');
    expect(article.className).toContain('[&_table]');
    const link = article.querySelector('a')!;
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(article.querySelector('img')).toBeNull();
    expect(article.textContent).toContain('private image');
    expect(article.querySelector('script')).toBeNull();
  });

  it('renders sanitized Markdown and copies it with success feedback', async () => {
    const reports = {
      renderMarkdown: vi.fn(() => '<p>safe</p>'),
      copyMarkdown: vi.fn().mockResolvedValue(undefined),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ReportResultComponent],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: ToastService, useValue: toast },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    })
      .overrideComponent(ReportResultComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportResultComponent);
    fixture.componentInstance.report = {
      markdown: '<script>x</script><img src=x onerror=alert(1)>[x](javascript:alert(1))',
      provider: 'p',
      model: 'm',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: 0,
      activityCount: 4,
    };
    fixture.detectChanges();
    expect(reports.renderMarkdown).toHaveBeenCalledWith(expect.stringContaining('<script>'));
    expect(fixture.nativeElement.querySelector('.markdown').innerHTML).toBe('<p>safe</p>');
    const objectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    fixture.componentInstance.download();
    expect(objectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:report');
    objectUrl.mockRestore();
    revokeUrl.mockRestore();
    click.mockRestore();
    await fixture.componentInstance.copy();
    expect(reports.copyMarkdown).toHaveBeenCalledWith(fixture.componentInstance.report.markdown);
    expect(toast.success).toHaveBeenCalledWith('reports.result.copied');
  });
  it('shows an error toast when copying fails', async () => {
    const reports = {
      renderMarkdown: vi.fn(() => ''),
      copyMarkdown: vi.fn().mockRejectedValue(new Error()),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ReportResultComponent],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: ToastService, useValue: toast },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    })
      .overrideComponent(ReportResultComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ReportResultComponent);
    fixture.componentInstance.report = {
      markdown: 'x',
      provider: 'p',
      model: 'm',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      activityCount: 0,
    };
    await fixture.componentInstance.copy();
    expect(toast.error).toHaveBeenCalledWith('reports.result.copyFailed');
  });
});
