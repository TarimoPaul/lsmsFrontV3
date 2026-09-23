import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { LanguageService } from '@core/i18n/language.service';
import { ThemeService } from '@core/theme/theme.service';
import { LsmsValidators } from '@shared/forms/validators';
import {
  ActionMenu,
  ApprovalActionBar,
  ApprovalStage,
  BranchSelector,
  Button,
  Card,
  DashboardKpiCard,
  DashboardKpiRow,
  DashboardPeakCard,
  DashboardRevenueCard,
  DashboardTodaySection,
  DataTable,
  DateField,
  DateRangeSelector,
  DialogService,
  EmptyState,
  ExportToolbar,
  FilterPanel,
  IconButton,
  KpiTrend,
  LiabilityStatusBadge,
  LinearProgress,
  LoadingOverlay,
  MetricCard,
  MetricsGrid,
  PageHeader,
  PaymentStatusBadge,
  ReturnStatusBadge,
  SegmentOption,
  SegmentedFilterBar,
  SelectField,
  Skeleton,
  Spinner,
  StatusChip,
  TableColumn,
  TextField,
  ToastService,
} from '@shared/ui';
import { MoneyPipe } from '@shared/utils/money';
import { DateRange, rangeForPreset } from '@shared/utils/date-utils';

interface DemoRow {
  uid: string;
  name: string;
  category: string;
  price: number;
  paid: number;
  stock: number;
}

const DEMO_ROWS: DemoRow[] = Array.from({ length: 37 }, (_, i) => ({
  uid: `p${i + 1}`,
  name: ['Sukari 1kg', 'Mchele 5kg', 'Mafuta 1L', 'Unga 2kg', 'Chumvi', 'Sabuni'][i % 6] + ` #${i + 1}`,
  category: ['Chakula', 'Usafi', 'Vinywaji'][i % 3],
  price: 1500 + ((i * 1370) % 48000),
  paid: i % 3 === 0 ? 0 : i % 3 === 1 ? 1500 + ((i * 1370) % 48000) : 800,
  stock: (i * 7) % 60,
}));

/**
 * Dev-only showcase of every shared UI component (`/dev/ui`).
 * Use it to compare against the Flutter widgets in light / eye-comfort /
 * dark themes and EN / SW before building feature modules.
 */
@Component({
  selector: 'app-ui-gallery',
  imports: [
    ReactiveFormsModule,
    MoneyPipe,
    ActionMenu,
    ApprovalActionBar,
    BranchSelector,
    Button,
    Card,
    DashboardKpiCard,
    DashboardKpiRow,
    DashboardPeakCard,
    DashboardRevenueCard,
    DashboardTodaySection,
    DataTable,
    DateField,
    DateRangeSelector,
    EmptyState,
    ExportToolbar,
    FilterPanel,
    IconButton,
    KpiTrend,
    LiabilityStatusBadge,
    LinearProgress,
    LoadingOverlay,
    MetricCard,
    MetricsGrid,
    PageHeader,
    PaymentStatusBadge,
    ReturnStatusBadge,
    SegmentedFilterBar,
    SelectField,
    Skeleton,
    Spinner,
    StatusChip,
    TableColumn,
    TextField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-gallery.html',
  styleUrl: './ui-gallery.scss',
})
export class UiGallery {
  protected readonly theme = inject(ThemeService);
  protected readonly i18n = inject(LanguageService);
  protected readonly toast = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly fb = inject(FormBuilder);

  protected readonly rows = DEMO_ROWS;
  protected readonly rowId = (r: DemoRow) => r.uid;
  protected readonly nameOf = (r: DemoRow) => r.name;
  protected readonly priceOf = (r: DemoRow) => r.price;
  protected readonly stockOf = (r: DemoRow) => r.stock;
  protected readonly tableLoading = signal(false);
  protected readonly selected = signal<DemoRow[]>([]);

  protected readonly filter = signal<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  protected readonly filterOptions: SegmentOption<'all' | 'paid' | 'partial' | 'unpaid'>[] = [
    { value: 'all', label: 'Zote', count: 37 },
    { value: 'paid', label: 'Imelipiwa', icon: 'check_circle', count: 12 },
    { value: 'partial', label: 'Sehemu', icon: 'schedule', count: 13 },
    { value: 'unpaid', label: 'Haijalipiwa', icon: 'cancel', count: 12 },
  ];

  protected readonly range = signal<DateRange>(rangeForPreset('thisMonth'));
  protected readonly branchUid = signal<string | null>(null);
  protected readonly branches = [
    { uid: 'b1', name: 'Kariakoo' },
    { uid: 'b2', name: 'Mwenge' },
    { uid: 'b3', name: 'Arusha Mjini' },
  ];
  protected readonly stage = signal<ApprovalStage>('draft');
  protected readonly overlayLoading = signal(false);
  protected readonly searchTerm = signal('');

  protected readonly form = this.fb.group({
    name: ['', [LsmsValidators.required('Product name'), LsmsValidators.minLength(2, 'Product name')]],
    price: [null as number | null, [LsmsValidators.required('Price'), LsmsValidators.currency('Price', 1)]],
    phone: ['', [LsmsValidators.phone()]],
    email: ['', [LsmsValidators.email()]],
    password: ['', [LsmsValidators.required('Password'), LsmsValidators.minLength(6, 'Password')]],
    category: [null as string | null, [LsmsValidators.required('Category')]],
    date: [null as Date | null, [LsmsValidators.required('Date')]],
    notes: [''],
  });
  protected readonly categoryOptions = [
    { value: 'c1', label: 'Chakula' },
    { value: 'c2', label: 'Usafi' },
    { value: 'c3', label: 'Vinywaji' },
  ];

  protected readonly hours = ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
  protected readonly today = [2, 5, 9, 14, 22, 30, 26, 18, 15, 20, 24, 19, 12, 7, 3];
  protected readonly yesterday = [3, 6, 7, 12, 18, 24, 28, 20, 13, 16, 20, 17, 10, 6, 2];

  protected rowActions(row: DemoRow) {
    return [
      { label: 'View', icon: 'visibility', run: () => this.toast.info(`View ${row.name}`) },
      { label: 'Edit', icon: 'edit', run: () => this.toast.info(`Edit ${row.name}`) },
      { label: 'Delete', icon: 'delete', destructive: true, run: () => this.confirmDelete(row) },
    ];
  }

  protected async confirmDelete(row: DemoRow): Promise<void> {
    const ok = await this.dialogs.confirmDelete({
      title: this.i18n.t('Delete product?', 'Futa bidhaa?'),
      message: this.i18n.t(`"${row.name}" will be removed.`, `"${row.name}" itaondolewa.`),
    });
    if (ok) this.toast.success(this.i18n.t('Deleted', 'Imefutwa'));
  }

  protected async confirmDemo(): Promise<void> {
    const ok = await this.dialogs.confirm({ title: 'Thibitisha', message: 'Endelea na hatua hii?' });
    this.toast.info(ok ? 'Confirmed' : 'Cancelled');
  }

  protected errorDemo(): void {
    void this.dialogs.error('Imeshindikana kuunganisha na seva.');
  }

  protected successDemo(): void {
    void this.dialogs.success('Mauzo yamehifadhiwa.');
  }

  protected progressDemo(): void {
    this.toast.progress('Exporting report…', 0);
    let p = 0;
    const timer = setInterval(() => {
      p += 0.2;
      this.toast.updateProgress(p);
      if (p >= 1) {
        clearInterval(timer);
        this.toast.dismiss();
        this.toast.success('Export complete');
      }
    }, 500);
  }

  protected loadingDemo(): void {
    this.toast.loading('Saving…');
    setTimeout(() => {
      this.toast.dismiss();
      this.toast.success('Saved');
    }, 2000);
  }

  protected overlayDemo(): void {
    this.overlayLoading.set(true);
    setTimeout(() => this.overlayLoading.set(false), 1500);
  }

  protected tableLoadingDemo(): void {
    this.tableLoading.set(true);
    setTimeout(() => this.tableLoading.set(false), 1500);
  }

  constructor() {
    // Dev convenience for screenshots: /dev/ui?theme=dark&lang=sw
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const theme = params.get('theme');
    if (theme === 'dark') this.theme.setTheme(true);
    if (theme === 'light') this.theme.setTheme(false);
    const lang = params.get('lang');
    if (lang === 'sw' || lang === 'en') this.i18n.setLanguage(lang);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) this.toast.success(JSON.stringify(this.form.getRawValue()));
    else this.toast.error(this.i18n.t('Please fix the highlighted fields', 'Tafadhali sahihisha sehemu zilizoonyeshwa'));
  }
}
