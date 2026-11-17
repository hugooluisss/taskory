import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('Access', () => {
  it('unauthenticated visit redirects to login with returnUrl', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/activities?page=2' } as never),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      '/login?returnUrl=%2Factivities%3Fpage%3D2',
    );
  });
});
