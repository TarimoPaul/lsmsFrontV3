import { TestBed } from '@angular/core/testing';

import { paymentStatusFromAmounts, returnStateFromStatus } from './badges/status-badges';
import { ToastService } from './toast/toast.service';

describe('paymentStatusFromAmounts', () => {
  it('derives status from money with a 1-cent tolerance', () => {
    expect(paymentStatusFromAmounts(0, 5000)).toEqual({ status: 'unpaid', percent: 0 });
    expect(paymentStatusFromAmounts(5000, 5000).status).toBe('paid');
    expect(paymentStatusFromAmounts(4999.995, 5000).status).toBe('paid');
    const partial = paymentStatusFromAmounts(1650, 5000);
    expect(partial.status).toBe('partial');
    expect(partial.percent).toBeCloseTo(0.33);
  });

  it('never reports more than 100%', () => {
    expect(paymentStatusFromAmounts(6000, 5000)).toEqual({ status: 'paid', percent: 1 });
  });
});

describe('returnStateFromStatus', () => {
  it('maps backend strings, defaulting to pending', () => {
    expect(returnStateFromStatus(false, 'APPROVED')).toBe('none');
    expect(returnStateFromStatus(true, 'APPROVED')).toBe('approved');
    expect(returnStateFromStatus(true, 'SOMETHING')).toBe('pending');
  });
});

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('auto-dismisses transient toasts', () => {
    toasts.success('Saved');
    expect(toasts.toasts().length).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(toasts.toasts()[0].exiting).toBe(true);
    vi.advanceTimersByTime(200);
    expect(toasts.toasts().length).toBe(0);
  });

  it('keeps at most 4 visible toasts', () => {
    for (let i = 0; i < 6; i++) toasts.info(`m${i}`);
    expect(toasts.toasts().filter((t) => !t.exiting).length).toBe(4);
  });

  it('keeps loading toasts until dismissed and updates progress', () => {
    toasts.progress('Exporting');
    toasts.updateProgress(0.5);
    vi.advanceTimersByTime(10_000);
    expect(toasts.toasts()[0].progress).toBe(0.5);
    toasts.dismiss();
    vi.advanceTimersByTime(200);
    expect(toasts.toasts().length).toBe(0);
  });
});
