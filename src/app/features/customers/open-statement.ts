import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ApiError } from '@core/api/api.types';
import { DialogService, ToastService } from '@shared/ui';
import { CustomersService } from './customers.service';

/**
 * Opens a customer's statement from anywhere (notification banners, the inbox) by
 * uid alone. Uses the shared customers cache; falls back to the Customers page if
 * the customer is not in it (e.g. deleted since).
 */
@Injectable({ providedIn: 'root' })
export class CustomerStatementLauncher {
  private readonly customers = inject(CustomersService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  async open(customerUid: string): Promise<void> {
    try {
      const list = this.customers.list.value() ?? (await this.customers.list.load());
      const customer = list.find((c) => c.uid === customerUid);
      if (!customer) {
        await this.router.navigateByUrl('/customers');
        return;
      }
      const { CustomerStatementDialog } = await import('./customer-statement-dialog');
      await this.dialogs.openAsync(CustomerStatementDialog, { size: 'lg', data: { customer } });
    } catch (e) {
      this.toast.error(ApiError.from(e).message);
    }
  }
}
