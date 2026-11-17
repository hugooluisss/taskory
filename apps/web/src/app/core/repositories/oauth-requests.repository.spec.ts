import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OAuthRequestsRepository } from './oauth-requests.repository';

describe('OAuthRequestsRepository', () => {
  let http: HttpTestingController;
  let repository: OAuthRequestsRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(OAuthRequestsRepository);
  });
  afterEach(() => http.verify());
  it('getRequest loads the consent details', () => {
    repository.getRequest('r1').subscribe();
    const request = http.expectOne('/api/v1/oauth/requests/r1');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });
  it('decide posts the approval choice', () => {
    repository.decide('r1', true).subscribe();
    const request = http.expectOne('/api/v1/oauth/requests/r1/decision');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ approve: true });
    request.flush({ redirectUrl: 'https://client.test/callback' });
  });
});
