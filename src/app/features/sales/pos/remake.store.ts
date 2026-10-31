import { Injectable } from '@angular/core';

import { Sale } from '../sales.models';

/**
 * Hands a deleted sale from the "Deleted sales" list to the till ("Make again", owner 31/10 bf). The server does
 * not serve a deleted sale by uid, so the list passes the copy it already has. Taken once.
 */
@Injectable({ providedIn: 'root' })
export class RemakeStore {
  private sale: Sale | null = null;

  set(s: Sale): void {
    this.sale = s;
  }

  take(): Sale | null {
    const s = this.sale;
    this.sale = null;
    return s;
  }
}
