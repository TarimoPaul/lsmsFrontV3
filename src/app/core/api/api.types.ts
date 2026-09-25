import { HttpErrorResponse } from '@angular/common/http';

/** Standard backend envelope: `Response<T>` in the Spring API. */
export interface ApiEnvelope<T> {
  status: 'Success' | 'Error' | string;
  data: T;
  message?: string | null;
  warnings?: string[] | null;
  errorCode?: string | null;
  // Paged endpoints may add these (`ResponseList` style)…
  totalPages?: number;
  currentPage?: number;
  totalItems?: number;
  // …or these (`ResponsePage` style, 1-based page).
  elements?: number;
  pages?: number;
  page?: number;
}

/** One page from a paged endpoint (`ResponsePage` / `ResponseList` with paging fields). */
export interface PageResult<T> {
  items: T[];
  /** Total number of records across all pages. */
  total: number;
  /** 1-based current page. */
  page: number;
  pages: number;
}

export interface ApiResult<T> {
  data: T;
  message: string | null;
  warnings: string[];
}

/**
 * Normalised API failure. `status` 0 = network / timeout (server unreachable).
 * `message` is always human-readable (backend message when available).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: string | null = null,
    readonly warnings: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /**
   * Build from an HttpErrorResponse. The backend returns either the JSON
   * envelope or — for some auth failures — a plain-text body (e.g. 401
   * "Invalid email or password", 429 "Account temporarily locked…").
   */
  static from(err: unknown, fallback = 'Request failed'): ApiError {
    if (err instanceof ApiError) return err;
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (err.status === 0) {
        return new ApiError('Cannot connect to server — check your connection', 0);
      }
      if (typeof body === 'string' && body.trim()) {
        const parsed = tryParseJson(body);
        if (parsed && typeof parsed === 'object') return ApiError.fromBody(parsed as Record<string, unknown>, err.status, fallback);
        return new ApiError(body.trim(), err.status);
      }
      if (body && typeof body === 'object') return ApiError.fromBody(body, err.status, fallback);
      return new ApiError(err.statusText && err.statusText !== 'OK' ? err.statusText : fallback, err.status);
    }
    if (err instanceof Error && err.name === 'TimeoutError') {
      return new ApiError('Connection timeout — server took too long to respond', 0);
    }
    return new ApiError(err instanceof Error ? err.message : fallback, -1);
  }

  private static fromBody(body: Record<string, unknown>, status: number, fallback: string): ApiError {
    const message = (body['message'] as string) || (body['error'] as string) || fallback;
    return new ApiError(
      message,
      status,
      (body['errorCode'] as string) ?? null,
      Array.isArray(body['warnings']) ? (body['warnings'] as string[]) : [],
    );
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
