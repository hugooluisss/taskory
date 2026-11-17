import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConnectedAppsRepository } from './connected-apps.repository';

describe('ConnectedAppsRepository', () => {
  let http: HttpTestingController;
  let repository: ConnectedAppsRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(ConnectedAppsRepository);
  });
  afterEach(() => http.verify());
  it('list gets connected applications', () => {
    repository.list().subscribe();
    const request = http.expectOne('/api/v1/connected-apps');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
  it('disconnect deletes a connected application', () => {
    repository.disconnect('c1').subscribe();
    const request = http.expectOne('/api/v1/connected-apps/c1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
