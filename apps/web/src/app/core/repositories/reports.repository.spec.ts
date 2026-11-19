import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportsRepository } from './reports.repository';

describe('ReportsRepository', () => {
  let http: HttpTestingController;
  let repository: ReportsRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(ReportsRepository);
  });
  afterEach(() => http.verify());
  it('create preserves the HTTP status', () => {
    repository.create({ from: '2026-01-01', to: '2026-01-02', language: 'en' }).subscribe();
    const request = http.expectOne('/api/v1/reports');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ from: '2026-01-01', to: '2026-01-02', language: 'en' });
    request.flush({}, { status: 202, statusText: 'Accepted' });
  });
  it('getJob polls a report', () => {
    repository.getJob('j1').subscribe();
    const request = http.expectOne('/api/v1/reports/j1');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });
  it('loads available styles and the saved custom prompt', () => {
    repository.getStyles().subscribe((styles) => expect(styles.customPrompt).toBe('Saved'));
    const request = http.expectOne('/api/v1/reports/styles');
    expect(request.request.method).toBe('GET');
    request.flush({ styles: [], customPrompt: 'Saved' });
  });
  it('retryJob posts to the retry endpoint', () => {
    repository.retryJob('j1').subscribe();
    const request = http.expectOne('/api/v1/reports/j1/retry');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({});
  });
  it('deleteJob removes the report', () => {
    repository.deleteJob('j1').subscribe();
    const request = http.expectOne('/api/v1/reports/j1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
  it('lists reports with pagination', () => {
    repository.list(2, 10).subscribe();
    const request = http.expectOne('/api/v1/reports?page=2&limit=10');
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 2, limit: 10 });
  });
  it('regenerates with the selected prompt', () => {
    repository
      .regenerate('r1', { style: 'custom', customPrompt: 'Focus', language: 'es' })
      .subscribe();
    const request = http.expectOne('/api/v1/reports/r1/regenerate');
    expect(request.request.body).toEqual({
      style: 'custom',
      customPrompt: 'Focus',
      language: 'es',
    });
    request.flush({});
  });
  it('renews the share URL', () => {
    repository.renewShare('r1').subscribe();
    const request = http.expectOne('/api/v1/reports/r1/share/renew');
    expect(request.request.method).toBe('POST');
    request.flush({ shareUrl: 'https://example/shared/t', shareExpiresAt: '2026-12-01' });
  });
  it('loads a public shared report', () => {
    repository.getShared('a/b').subscribe();
    const request = http.expectOne('/api/v1/shared/a%2Fb');
    expect(request.request.method).toBe('GET');
    request.flush({ period: { from: '', to: '' }, language: 'en', projects: [], activities: [] });
  });
});
