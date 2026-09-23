import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { Sidebar } from '../shell/sidebar/sidebar';
import { MainDashboard } from './main-dashboard';

async function signInAsCashier() {
  const auth = TestBed.inject(AuthService);
  const http = TestBed.inject(HttpTestingController);
  const p = auth.login('cashier@shop.co.tz', 'secret', false);
  http.expectOne('/api/auth/login').flush({
    status: 'Success',
    data: {
      tokenInfo: { token: 't', email: 'cashier@shop.co.tz', firstName: 'Asha', lastName: 'Juma' },
      roles: ['SALES'],
      permissions: ['SALES_READ', 'SALES_CREATE', 'CUSTOMER_READ', 'PRODUCT_VIEW'],
      branches: [{ uid: 'b', branchName: 'Main Branch', isMainBranch: true }],
      selectedBranchUid: 'b',
    },
  });
  await p;
  return http;
}

describe('RBAC in the UI (non-root user)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [MainDashboard, Sidebar],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('dashboard locks tiles outside the role and unlocks the rest', async () => {
    await signInAsCashier();
    const fixture = TestBed.createComponent(MainDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const tiles = [...el.querySelectorAll<HTMLElement>('.tile')];
    const unlocked = tiles.filter((t) => !t.classList.contains('locked')).map((t) => t.querySelector('strong')!.textContent!.trim());
    expect(tiles.length).toBe(18);
    expect(unlocked).toEqual(['Sales', 'Products', 'Customers']);
    expect(el.querySelector('.hello h1')!.textContent).toContain('Asha');
    expect(el.querySelector('.chip.role')!.textContent).toContain('SALES');
  });

  it('sidebar shows the same locks as the dashboard', async () => {
    await signInAsCashier();
    const fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const locked = el.querySelectorAll('a.item.locked').length;
    const modules = el.querySelectorAll('a.item').length;
    // 1 home + 18 modules + 4 account links; only the 18 modules can lock.
    expect(modules).toBe(23);
    expect(locked).toBe(15);
  });
});
