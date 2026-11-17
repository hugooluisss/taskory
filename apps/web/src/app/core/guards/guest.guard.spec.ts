import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { guestGuard } from './guest.guard';

describe('Access', () => {
  it('authenticated visitor on a guest route is sent to activities', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
      ],
    });
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/activities');
  });
});
