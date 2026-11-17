import { ApplicationInitStatus } from '@angular/core';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';

describe('Runtime API configuration', () => {
  it('runs the application initializer through config and session loading', async () => {
    localStorage.setItem('taskory_token', 'token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ apiBaseUrl: '/api/v1' }), { status: 200 }),
    );
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const initialization = TestBed.inject(ApplicationInitStatus);
    let session!: TestRequest;
    await vi.waitFor(() => {
      session = http.expectOne('/api/v1/auth/me');
    });
    session.flush({ id: 'u1', email: 'ada@example.test', name: 'Ada', language: 'en' });
    await initialization.donePromise;
    expect(initialization.done).toBe(true);
    expect(document.documentElement.lang).toBe('en');
    http.verify();
    localStorage.removeItem('taskory_token');
  });
});
