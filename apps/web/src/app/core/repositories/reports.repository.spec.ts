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
});
