import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../api-error';
import { ConfigService } from '../config.service';
import { AuthService } from '../services/auth.service';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const apiBaseUrl = inject(ConfigService).apiBaseUrl;
  const isApiRequest = request.url.startsWith(apiBaseUrl);
  const token = auth.token();
  const authorized =
    isApiRequest && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;
  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const body =
        typeof error.error === 'object' && error.error !== null
          ? (error.error as Record<string, unknown>)
          : {};
      const code =
        typeof body['code'] === 'string'
          ? body['code']
          : error.status === 0
            ? 'NETWORK_ERROR'
            : 'UNKNOWN';
      const details = Object.fromEntries(
        Object.entries(body).filter(([key]) => !['statusCode', 'code', 'message'].includes(key)),
      );
      const isAuthRequest = /\/auth\/(login|register)(\?|$)/.test(request.url);
      if (isApiRequest && error.status === 401 && !isAuthRequest) {
        auth.logout();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => new ApiError(code, error.status, details));
    }),
  );
};
