import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivitiesRepository } from './activities.repository';

describe('ActivitiesRepository', () => {
  let http: HttpTestingController;
  let repository: ActivitiesRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(ActivitiesRepository);
  });
  afterEach(() => http.verify());
  it('list encodes filters and omits empty values', () => {
    repository.list({ from: ' 2026-01-01 ', q: '', page: 2 }).subscribe();
    const request = http.expectOne('/api/v1/activities?from=%202026-01-01%20&page=2');
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 2, limit: 50 });
  });
  it('get reads one activity', () => {
    repository.get('a1').subscribe();
    const request = http.expectOne('/api/v1/activities/a1');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });
  it('create posts an activity', () => {
    repository.create({ date: '2026-01-01', title: 'Work' }).subscribe();
    const request = http.expectOne('/api/v1/activities');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ date: '2026-01-01', title: 'Work' });
    request.flush({});
  });
  it('update patches an activity', () => {
    repository.update('a1', { title: 'Changed' }).subscribe();
    const request = http.expectOne('/api/v1/activities/a1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ title: 'Changed' });
    request.flush({});
  });
  it('delete removes an activity', () => {
    repository.delete('a1').subscribe();
    const request = http.expectOne('/api/v1/activities/a1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
  it('meta gets project and tag suggestions', () => {
    repository.meta().subscribe();
    const request = http.expectOne('/api/v1/activities/meta');
    expect(request.request.method).toBe('GET');
    request.flush({ projects: [], tags: [] });
  });
});
