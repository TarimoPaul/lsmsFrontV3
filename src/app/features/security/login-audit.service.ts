import { Injectable, inject } from '@angular/core';

import { ApiService, type QueryParams } from '@core/api/api.service';
import { AuthService } from '@core/auth/auth.service';

/** One login attempt / logout / password change as backend 2.4.0 A3 recorded it (login_audit). */
export interface LoginRow {
  id: number;
  at: string;
  event: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_CHANGE';
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'DENIED' | 'ERROR';
  failureReason: string | null;
  email: string | null;
  userUid: string | null;
  userName: string | null;
  isRoot: boolean;
  ip: string | null;
  country: string | null;
  asn: number | null;
  asnOrg: string | null;
  networkFlag: 'NORMAL' | 'DATACENTER' | 'VPN' | 'PRIVATE' | 'DIRECT' | 'UNKNOWN';
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: string | null;
  newDevice: boolean;
  alert: string | null;
  /** Has an alert that needs a look and nobody marked it SEEN. */
  alerting: boolean;
  seen: boolean;
  userAgent: string | null;
}

export interface KnownNetwork {
  userUid: string;
  userName: string | null;
  email: string | null;
  asn: number;
  asnOrg: string | null;
  byName: string | null;
  at: string;
  note: string;
}

export interface LoginFilter {
  from?: string;
  to?: string;
  email?: string;
  result?: string;
  flag?: string;
  event?: string;
  newDevice?: boolean;
  rootOnly?: boolean;
  alertsOnly?: boolean;
}

type Raw = Record<string, unknown>;

/** Usalama → Login (backend A3, design MUUNDO-LOGIN-AUDIT.md §6). LOGIN_AUDIT_VIEW; the CSV needs LOGIN_AUDIT_EXPORT. */
@Injectable({ providedIn: 'root' })
export class LoginAuditService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  get canView(): boolean {
    return this.auth.hasPermission('LOGIN_AUDIT_VIEW');
  }

  get canExport(): boolean {
    return this.auth.hasPermission('LOGIN_AUDIT_EXPORT');
  }

  async list(f: LoginFilter, size = 200): Promise<{ items: LoginRow[]; total: number; attribution: string }> {
    const d = await this.api.get<Raw>('/api/security/logins', { params: { ...f, size } as QueryParams });
    return {
      items: ((d['items'] as LoginRow[]) ?? []),
      total: Number(d['total'] ?? 0),
      attribution: String(d['attribution'] ?? 'IP geolocation by DB-IP (https://db-ip.com)'),
    };
  }

  async alerts(limit = 5): Promise<{ open: number; items: LoginRow[] }> {
    const d = await this.api.get<Raw>('/api/security/logins/alerts', { params: { limit } });
    return { open: Number(d['open'] ?? 0), items: (d['items'] as LoginRow[]) ?? [] };
  }

  /** SEEN closes this row's alert; KNOWN_NETWORK silences this user's VPN/DATACENTER alert from this ASN (note ≥ 10). */
  async ack(id: number, kind: 'SEEN' | 'KNOWN_NETWORK' | 'KNOWN_NETWORK_REVOKED', note?: string): Promise<void> {
    await this.api.post(`/api/security/logins/${id}/ack`, { kind, note: note ?? null });
  }

  async knownNetworks(): Promise<KnownNetwork[]> {
    return (await this.api.get<KnownNetwork[] | null>('/api/security/known-networks')) ?? [];
  }

  async revoke(userUid: string, asn: number, note: string): Promise<void> {
    await this.api.post('/api/security/known-networks/revoke', { userUid, asn, note });
  }

  /** The server writes the export to the audit trail before it sends a byte. */
  async exportCsv(f: LoginFilter): Promise<Blob> {
    return this.api.blob('/api/security/logins/export.csv', { params: f as QueryParams });
  }
}
