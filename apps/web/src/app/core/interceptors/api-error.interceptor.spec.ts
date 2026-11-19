import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { apiErrorInterceptor } from './api-error.interceptor';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../api-error';

describe('Access', () => {
  let http: HttpTestingController;
  let router: Router;
  const auth = { token: signal('jwt'), logout: vi.fn() };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });
  afterEach(() => {
    http.verify();
    vi.clearAllMocks();
  });
  it('Authenticated requests include the Bearer token', () => {
    TestBed.inject(HttpClient).get('/api/v1/auth/me').subscribe();
    const request = http.expectOne('/api/v1/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({});
  });
  it('does not send the session token to runtime translation assets', () => {
    TestBed.inject(HttpClient).get('/assets/i18n/en.json').subscribe();
    const request = http.expectOne('/assets/i18n/en.json');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
  it('Expired session clears and redirects to login with returnUrl', () => {
    TestBed.inject(HttpClient)
      .get('/api/v1/activities')
      .subscribe({ error: () => undefined });
    http.expectOne('/api/v1/activities').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });
  it('Expired register request does not clear or redirect the session', () => {
    TestBed.inject(HttpClient)
      .post('/api/v1/auth/register', {})
      .subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/register').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
  });
  it('Expired login request does not clear or redirect the session', () => {
    TestBed.inject(HttpClient)
      .post('/api/v1/auth/login', {})
      .subscribe({ error: (error: HttpErrorResponse) => expect(error).toBeTruthy() });
    http.expectOne('/api/v1/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
  });
  it('preserves extra API error envelope fields', () => {
    let caught: unknown;
    TestBed.inject(HttpClient)
      .post('/api/v1/reports', {})
      .subscribe({ error: (error) => (caught = error) });
    http
      .expectOne('/api/v1/reports')
      .flush(
        { statusCode: 409, code: 'REPORT_IN_PROGRESS', message: 'Active report', id: 'report-7' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).details).toEqual({ id: 'report-7' });
  });
  it('uses an empty details record when the API error envelope has no extra fields', () => {
    let caught: unknown;
    TestBed.inject(HttpClient)
      .get('/api/v1/reports/runs')
      .subscribe({ error: (error) => (caught = error) });
    http
      .expectOne('/api/v1/reports/runs')
      .flush(
        { statusCode: 502, code: 'LLM_UNAVAILABLE', message: 'Unavailable' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).details).toEqual({});
  });
  it('public shared links send no session token or redirect on unauthorized responses', () => {
    TestBed.inject(HttpClient)
      .get('/api/v1/shared/public-token')
      .subscribe({ error: () => undefined });
    const request = http.expectOne('/api/v1/shared/public-token');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
