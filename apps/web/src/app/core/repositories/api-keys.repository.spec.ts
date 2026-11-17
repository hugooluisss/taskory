import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiKeysRepository } from './api-keys.repository';

describe('ApiKeysRepository', () => {
  let http: HttpTestingController;
  let repository: ApiKeysRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(ApiKeysRepository);
  });
  afterEach(() => http.verify());
  it('list gets api keys', () => {
    repository.list().subscribe();
    const request = http.expectOne('/api/v1/api-keys');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
  it('create posts the name and returns the key once', () => {
    repository.create('agent').subscribe();
    const request = http.expectOne('/api/v1/api-keys');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'agent' });
    request.flush({ id: '1', name: 'agent', key: 'tk_secret' });
  });
  it('revoke deletes an api key', () => {
    repository.revoke('k1').subscribe();
    const request = http.expectOne('/api/v1/api-keys/k1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
