import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  let http: HttpTestingController;
  let repository: AuthRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    repository = TestBed.inject(AuthRepository);
  });
  afterEach(() => http.verify());
  it('register posts the account fields', () => {
    repository.register({ email: 'a@b.test', password: 'password1', name: 'Ada' }).subscribe();
    const request = http.expectOne('/api/v1/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'a@b.test', password: 'password1', name: 'Ada' });
    request.flush({ token: 't', user: {} });
  });
  it('login posts credentials', () => {
    repository.login({ email: 'a@b.test', password: 'password1' }).subscribe();
    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'a@b.test', password: 'password1' });
    request.flush({ token: 't', user: {} });
  });
  it('me gets the current user', () => {
    repository.me().subscribe();
    const request = http.expectOne('/api/v1/auth/me');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });
  it('updateMe patches the profile', () => {
    repository.updateMe({ language: 'es' }).subscribe();
    const request = http.expectOne('/api/v1/auth/me');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ language: 'es' });
    request.flush({});
  });
});
