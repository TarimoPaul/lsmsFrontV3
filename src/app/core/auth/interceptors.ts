import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';

import { AuthService } from './auth.service';
import { SKIP_AUTH_REDIRECT, SKIP_RETRY } from './auth.tokens';

const PUBLIC_PREFIXES = ['/api/public/', '/api/auth/login', '/api/auth/refresh'];

/**
 * Adds `Authorization: Bearer <token>` to API calls and force-logs-out on a
 * 401 from a protected endpoint (port of Flutter `AuthInterceptor`).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isPublic = PUBLIC_PREFIXES.some((p) => req.url.includes(p));
  const token = auth.token();

  const authed =
    token && !isPublic && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !isPublic &&
        !req.context.get(SKIP_AUTH_REDIRECT)
      ) {
        auth.handleUnauthorized();
      }
      return throwError(() => err);
    }),
  );
};

const RETRY_DELAYS = [1000, 2000];
const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/**
 * Retries ONLY transient network failures (status 0: connection refused,
 * DNS, offline) with 1s / 2s backoff — never an HTTP response, and never a
 * POST/PATCH, so a sale can't be written twice (Flutter `RetryInterceptor`).
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (!IDEMPOTENT.has(req.method) || req.context.get(SKIP_RETRY)) return next(req);
  return next(req).pipe(
    retry({
      count: RETRY_DELAYS.length,
      delay: (err, attempt) => {
        if (err instanceof HttpErrorResponse && err.status === 0) return timer(RETRY_DELAYS[attempt - 1]);
        return throwError(() => err);
      },
    }),
  );
};
