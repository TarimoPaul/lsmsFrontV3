import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope, ApiError, ApiResult } from './api.types';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  params?: QueryParams;
  context?: HttpContext;
  /** Milliseconds; default 30s (auth calls use 15s like Flutter). */
  timeoutMs?: number;
}

/**
 * Thin, promise-based client over HttpClient that unwraps the backend
 * `{ status, data, message, warnings }` envelope.
 *
 *   const cats = await api.get<CategoryDto[]>('/api/v1/categories');
 *   const { data, warnings } = await api.postResult<SaleDto>('/api/v1/sales', body);
 *
 * Non-"Success" envelopes and HTTP errors are thrown as `ApiError`.
 * Paths are relative (`/api/...`): dev server proxies them to :8086 and in
 * production nginx serves frontend + API on the same origin.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  async get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return (await this.getResult<T>(path, opts)).data;
  }

  async post<T>(path: string, body: unknown = {}, opts: RequestOptions = {}): Promise<T> {
    return (await this.postResult<T>(path, body, opts)).data;
  }

  async put<T>(path: string, body: unknown = {}, opts: RequestOptions = {}): Promise<T> {
    return (await this.putResult<T>(path, body, opts)).data;
  }

  async patch<T>(path: string, body: unknown = {}, opts: RequestOptions = {}): Promise<T> {
    return this.unwrap(this.http.patch<ApiEnvelope<T>>(this.url(path), body, this.httpOpts(opts)), opts).then(
      (r) => r.data,
    );
  }

  async delete<T = void>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.unwrap(this.http.delete<ApiEnvelope<T>>(this.url(path), this.httpOpts(opts)), opts).then(
      (r) => r.data,
    );
  }

  getResult<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.unwrap(this.http.get<ApiEnvelope<T>>(this.url(path), this.httpOpts(opts)), opts);
  }

  postResult<T>(path: string, body: unknown = {}, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.unwrap(this.http.post<ApiEnvelope<T>>(this.url(path), body, this.httpOpts(opts)), opts);
  }

  putResult<T>(path: string, body: unknown = {}, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    return this.unwrap(this.http.put<ApiEnvelope<T>>(this.url(path), body, this.httpOpts(opts)), opts);
  }

  /** Download a binary (exports / PDFs). */
  async blob(path: string, opts: RequestOptions = {}): Promise<Blob> {
    try {
      return await firstValueFrom(
        this.http
          .get(this.url(path), { ...this.httpOpts(opts), responseType: 'blob' })
          .pipe(timeout(opts.timeoutMs ?? 60_000)),
      );
    } catch (e) {
      throw ApiError.from(e);
    }
  }

  url(path: string): string {
    return path.startsWith('http') ? path : `${this.base}${path}`;
  }

  private httpOpts(opts: RequestOptions) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(opts.params ?? {})) {
      if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    }
    return { params, context: opts.context };
  }

  private async unwrap<T>(req: Observable<ApiEnvelope<T>>, opts: RequestOptions): Promise<ApiResult<T>> {
    let env: ApiEnvelope<T>;
    try {
      env = await firstValueFrom(req.pipe(timeout(opts.timeoutMs ?? 30_000)));
    } catch (e) {
      throw ApiError.from(e);
    }
    // Some endpoints return raw payloads (no envelope) — pass them through.
    if (env === null || typeof env !== 'object' || !('status' in env)) {
      return { data: env as unknown as T, message: null, warnings: [] };
    }
    if (env.status !== 'Success') {
      throw new ApiError(env.message || 'Request failed', 200, env.errorCode ?? null, env.warnings ?? []);
    }
    return { data: env.data, message: env.message ?? null, warnings: env.warnings ?? [] };
  }
}
