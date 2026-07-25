import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import { WalletService } from '../../services/wallet.service';
import { DebtService } from '../../services/debts.service';
import { LoanService } from '../../services/loans.service';
import { DateService } from '../../services/date.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeService } from '../../services/income.service';
import { InvoiceService } from '../../services/invoice.service';
import { SavingsService } from '../../services/savings.service';
import { Invoice } from '../../models/invoice.model';

import { WalletAccount } from '../../models/wallet.model';
import { Debt } from '../../models/debt.model';

import { Loan } from '../../models/loans.model';
import { CategoriaGasto, Expense } from '../../models/expense.model';
import { Income } from '../../models/income.model';
import { FinanzasService } from '../../services/finanzas.service';
import { Saving } from '../../models/savings.model';
import { BarChartComponent } from '../../shared/components/bar-chart/bar-chart.component';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { inject } from '@angular/core';
import { FinancialChartComponent } from '../../shared/components/financial-chart/financial-chart.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { PlannerService } from '../../services/planner.service';
import { MonthlyHistoryItem, SavingGoal } from '../../models/planner.model';
import { Projection, ProjectionService } from '../../services/projection.service';

interface DebtWithId extends Debt {
  id: string;
}

interface SavingWithId extends Saving {
  id: string;
}

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu?: boolean;
}

export interface InvoiceWithId extends Invoice {
  id: string;
  showMenu: boolean;
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    FinancialChartComponent,
    BarChartComponent,
    ModalShellComponent,
  ],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css'],
})
export default class StatisticsComponent implements OnInit, OnDestroy {
  private dateSubscription: Subscription | undefined;
  private authService = inject(AuthService);
  private plannerService = inject(PlannerService);

  isModalDeudaOpen = false;
  isModalCuentaOpen = false;
  isModalPrestamoOpen = false;
  isModalGastoOpen = false;
  selectedYear: string = '';
  selectedMonth: string = '';

  isPayInvoiceModalOpen: boolean = false;
  payInvoice: any = null;
  selectedWalletForPayment: string = '';

  nuevaCuenta: WalletAccount = new WalletAccount('', 0);
  nuevoGasto: Expense = new Expense('', CategoriaGasto.Comida, 0, 0);
  nuevaDeuda: Debt = new Debt('', '', '', 0, 'Pendiente');
  nuevoPrestamo: Loan = new Loan('', '', '', 0, 'Pendiente');

  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';

  userId!: string;

  wallet: WalletAccountWithId[] = [];
  debts: DebtWithId[] = [];
  loans: Loan[] = [];
  gastos: Expense[] = [];
  ingresos: Income[] = [];
  invoices: InvoiceWithId[] = [];
  savings: SavingWithId[] = [];

  gastosPorCategoria: { categoria: string; total: number; pct: number }[] = [];
  topGastos: Expense[] = [];
  tendenciaBalance: { direccion: 'sube' | 'baja' | 'estable'; pct: number } = { direccion: 'estable', pct: 0 };

  currentYear: string = new Date().getFullYear().toString();
  currentMonth: string = (new Date().getMonth() + 1).toString().padStart(2, '0');

  saludFinanciera: 'positiva' | 'advertencia' | 'critica' = 'positiva';
  mensajeSaludFinanciera: string = 'Cargando estado financiero...';

  categorias = Object.values(CategoriaGasto);

  cuadreDescuadre: number = 0;
  estadoFinanciero: string = '';
  estimacionGastosMes: number = 0;
  estimacionDineroRestanteMes: number = 0;
  gastadoActualmente: number = 0;
  restanteActualmente: number = 0;
  restanteTotal: number = 0;
  diferenciaSaldo: number = 0;

  totalBilletera: number = 0;
  gastosTotales: number = 0;
  totalDeuda: number = 0;
  totalPrestamo: number = 0;
  ingresosTotales: number = 0;
  totalAhorro: number = 0;
  savingGoal: SavingGoal | null = null;
  isEditingSavingGoal = false;
  draftSavingGoal: SavingGoal = { titulo: '', montoObjetivo: 0 };
  monthlyHistory: MonthlyHistoryItem[] = [];
  projection: Projection | null = null;
  canInstallApp = false;
  appInstalled = false;
  installHelpVisible = false;
  private deferredInstallPrompt: any = null;

  get isIos(): boolean {
    return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  private getGlobalInstallPrompt(): any {
    return isPlatformBrowser(this.platformId) ? (window as any).__deferredInstallPrompt ?? null : null;
  }

  private setGlobalInstallPrompt(prompt: any): void {
    if (isPlatformBrowser(this.platformId)) {
      (window as any).__deferredInstallPrompt = prompt;
    }
  }

  constructor(
    private walletService: WalletService,
    private debtService: DebtService,
    private loanService: LoanService,
    private expenseService: ExpenseService,
    private incomeService: IncomeService,
    private dateService: DateService,
    private invoiceService: InvoiceService,
    private savingsService: SavingsService,
    public router: Router,
    private route: ActivatedRoute,
    private finanzasService: FinanzasService,
    private projectionService: ProjectionService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.setupInstallPrompt();
    this.loadInvoices();

    this.dateSubscription = this.dateService.selectedDate$.subscribe(
      ({ year, month }: { year: string; month: string }) => {
        if (year && month) {
          this.currentYear = year;
          this.currentMonth = month;
          this.plannerService
            .ensureRecurringItemsApplied(
              this.currentUser,
              this.currentYear,
              this.currentMonth,
              this.incomeService,
              this.expenseService
            )
            .subscribe(() => {
              this.loadData();
              this.loadSavingGoal();
              this.loadMonthlyHistory();
            });
        }
      }
    );

    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.currentUser,
      this.currentYear,
      this.currentMonth
    );
    this.authService.startAutoLogout();
    this.loadInvoices();

    this.route.queryParamMap.subscribe((params) => {
      if (params.get('focus') === 'alerts' && isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          document.getElementById('alerts-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  private setupInstallPrompt(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.appInstalled = window.matchMedia('(display-mode: standalone)').matches;
    this.deferredInstallPrompt = this.getGlobalInstallPrompt();
    this.canInstallApp = !!this.deferredInstallPrompt;

    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      this.setGlobalInstallPrompt(event);
      this.canInstallApp = true;
      this.installHelpVisible = false;
    });

    window.addEventListener('appinstalled', () => {
      this.appInstalled = true;
      this.canInstallApp = false;
      this.installHelpVisible = false;
      this.deferredInstallPrompt = null;
      this.setGlobalInstallPrompt(null);
    });
  }

  async installApp(): Promise<void> {
    if (!this.deferredInstallPrompt) {
      this.installHelpVisible = true;
      return;
    }

    this.deferredInstallPrompt.prompt();
    const choice = await this.deferredInstallPrompt.userChoice;

    if (choice?.outcome !== 'accepted') {
      this.installHelpVisible = true;
    }

    this.deferredInstallPrompt = null;
    this.setGlobalInstallPrompt(null);
    this.canInstallApp = false;
  }

  loadData() {
    const userId = this.currentUser;
    if (!userId) return;
    forkJoin({
      wallet: this.walletService.getWallet(userId, this.currentYear, this.currentMonth),
      debts: this.debtService.getDebts(userId, this.currentYear, this.currentMonth),
      loans: this.loanService.getLoans(userId, this.currentYear, this.currentMonth),
      expenses: this.expenseService.getExpenses(userId, this.currentYear, this.currentMonth),
      incomes: this.incomeService.getIncomes(userId, this.currentYear, this.currentMonth),
      savings: this.savingsService.getSavings(userId, this.currentYear, this.currentMonth),
    }).subscribe(({ wallet, debts, loans, expenses, incomes, savings }) => {
      this.wallet = Object.entries(wallet || {}).map(([id, item]: [string, any]) => ({ id, ...item }));
      this.debts = Object.entries(debts || {}).map(([id, item]: [string, any]) => ({ id, ...item }));
      this.loans = Object.entries(loans || {}).map(([id, item]: [string, any]) => ({ id, ...item }));
      this.gastos = Object.entries(expenses || {}).map(([id, item]: [string, any]) => ({ id, ...item }));
      this.ingresos = Object.entries(incomes || {}).map(([id, item]: [string, any]) => ({ id, ...item }));
      this.savings = Object.entries(savings || {}).map(([id, item]: [string, any]) => ({ id, ...item }));
      this.evaluarSaludFinanciera();
      this.calcularTotales();
      this.refreshProjection();
      this.loadInvoices();
      this.computeGastosPorCategoria();
      this.computeTopGastos();
    });
    this.finanzasService.mostrarEstadoFinanciero(this, this.currentUser, this.currentYear, this.currentMonth);
  }

  private calcularTotales() {
    this.totalDeuda = this.debts?.reduce((a, d) => a + (d.valor || 0), 0);
    this.totalPrestamo = this.loans?.reduce((a, p) => a + (p.valor || 0), 0);
    this.ingresosTotales = this.ingresos?.reduce((a, i) => a + (i.valor || 0), 0);
    this.gastosTotales = this.gastos?.reduce((a, g) => a + (g.valor || 0), 0);
    this.totalBilletera = this.wallet?.reduce((a, c) => a + (c.valor || 0), 0);
    this.restanteTotal = this.totalBilletera + this.totalPrestamo - this.totalDeuda;
    if (!this.ingresosTotales && this.restanteTotal) {
      this.ingresosTotales = this.restanteTotal;
    }
    this.totalAhorro = this.savings?.reduce((sum, item) => sum + (item.valor || 0), 0);
  }

  private refreshProjection(): void {
    const today = new Date();
    const elapsedDays = Math.max(1, today.getDate());
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    this.projection = this.projectionService.calculate({
      period: `${this.currentYear}-${this.currentMonth}`,
      currentBalance: this.restanteActualmente,
      monthIncome: this.ingresosTotales,
      monthExpense: this.gastosTotales,
      elapsedDays,
      totalDays,
      currentPlan: this.estimacionDineroRestanteMes,
    });
  }

  loadSavingGoal() {
    this.plannerService.getSavingGoal(this.currentUser).subscribe((goal) => {
      this.savingGoal = goal;
      this.draftSavingGoal = goal
        ? { ...goal }
        : { titulo: 'Mi meta principal', montoObjetivo: 0 };
    });
  }

  startSavingGoalEdit() {
    this.isEditingSavingGoal = true;
    this.draftSavingGoal = this.savingGoal
      ? { ...this.savingGoal }
      : { titulo: 'Mi meta principal', montoObjetivo: 0 };
  }

  cancelSavingGoalEdit() {
    this.isEditingSavingGoal = false;
    this.draftSavingGoal = this.savingGoal
      ? { ...this.savingGoal }
      : { titulo: 'Mi meta principal', montoObjetivo: 0 };
  }

  saveSavingGoal() {
    if (!this.draftSavingGoal.titulo.trim() || this.draftSavingGoal.montoObjetivo <= 0) return;
    this.plannerService
      .saveSavingGoal(this.currentUser, {
        titulo: this.draftSavingGoal.titulo.trim(),
        montoObjetivo: this.draftSavingGoal.montoObjetivo,
      })
      .subscribe(() => {
        this.savingGoal = { ...this.draftSavingGoal, titulo: this.draftSavingGoal.titulo.trim() };
        this.isEditingSavingGoal = false;
      });
  }

  onDraftSavingGoalAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');
    const value = Number(raw) || 0;
    this.draftSavingGoal.montoObjetivo = value;
    input.value = value ? value.toLocaleString('es-CO') : '';
  }

  get historyMaxValue(): number {
    return Math.max(
      1,
      ...this.monthlyHistory.map((item) =>
        Math.max(item.ingresos || 0, item.gastos || 0, item.ahorro || 0, item.saldo || 0)
      )
    );
  }

  get savingGoalProgress(): number {
    if (!this.savingGoal?.montoObjetivo) return 0;
    return Math.min(100, Math.round((this.totalAhorro / this.savingGoal.montoObjetivo) * 100));
  }

  getPiggybankName(item: any): string {
    return (item?.nombre || item?.tipo || 'Alcancía').trim();
  }

  getPiggybankProgress(item: any): number {
    const meta = Number(item?.metaAhorro || 0);
    const valor = Number(item?.valor || 0);
    if (!meta) return 0;
    return Math.min(100, Math.round((valor / meta) * 100));
  }

  getAveragePiggybankProgress(): number {
    if (!this.savings?.length) return 0;
    const progresses = this.savings.map((item) => this.getPiggybankProgress(item));
    const total = progresses.reduce((sum, p) => sum + p, 0);
    return Math.round(total / progresses.length);
  }

  enterPiggybankFromHome(piggybankId: string): void {
    this.router.navigate(['/app/saving'], { queryParams: { piggybank: piggybankId } });
  }

  loadMonthlyHistory() {
    const periods = this.buildRecentPeriods(6);
    const requests = periods.map((period) =>
      forkJoin({
        incomes: this.incomeService.getIncomes(this.currentUser, period.year, period.month),
        expenses: this.expenseService.getExpenses(this.currentUser, period.year, period.month),
        savings: this.savingsService.getSavings(this.currentUser, period.year, period.month),
        wallet: this.walletService.getWallet(this.currentUser, period.year, period.month),
      })
    );

    forkJoin(requests).subscribe((results) => {
      this.monthlyHistory = results.map((result, index) => ({
        period: `${periods[index].month}/${periods[index].year}`,
        ingresos: Object.values(result.incomes || {}).reduce((sum: number, item: any) => sum + (item.valor || 0), 0),
        gastos: Object.values(result.expenses || {}).reduce((sum: number, item: any) => sum + (item.valor || 0), 0),
        ahorro: Object.values(result.savings || {}).reduce((sum: number, item: any) => sum + (item.valor || 0), 0),
        saldo: Object.values(result.wallet || {}).reduce((sum: number, item: any) => sum + (item.valor || 0), 0),
      })).reverse();
      this.computeTendenciaBalance();
    });
  }

  private buildRecentPeriods(count: number): Array<{ year: string; month: string }> {
    const periods: Array<{ year: string; month: string }> = [];
    const baseDate = new Date(Number(this.currentYear), Number(this.currentMonth) - 1, 1);
    for (let i = 0; i < count; i++) {
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      periods.push({
        year: `${date.getFullYear()}`,
        month: `${date.getMonth() + 1}`.padStart(2, '0'),
      });
    }
    return periods;
  }

  get currentUser(): string {
    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.localId || '';
    }
    return '';
  }

  get totalWallet(): number {
    return this.wallet.reduce((sum, w) => sum + (w.valor || 0), 0);
  }

  get totalPendingDebts(): number {
    return this.debts.filter((d) => d.estado === 'Pendiente').reduce((sum, d) => sum + (d.valor || 0), 0);
  }

  get totalPendingLoans(): number {
    return this.loans.filter((l) => l.estado === 'Pendiente').reduce((sum, l) => sum + (l.valor || 0), 0);
  }

  evaluarSaludFinanciera() {
    const ingresoTotalMes = this.ingresos.reduce((acc, i) => acc + (i.valor || 0), 0);
    const deudasPendientes = this.debts.filter((d) => d.estado === 'Pendiente');
    const totalDeudasPendientes = deudasPendientes.reduce((sum, d) => sum + (d.valor || 0), 0);
    const estimacionesGastosMes = this.gastos.reduce((acc, g) => acc + (g.estimacion || 0), 0);
    const totalCompromisos = totalDeudasPendientes + estimacionesGastosMes;

    if (ingresoTotalMes > totalCompromisos) {
      this.saludFinanciera = 'positiva';
      this.mensajeSaludFinanciera = 'Finanzas saludables';
    } else if (ingresoTotalMes === totalCompromisos) {
      this.saludFinanciera = 'advertencia';
      this.mensajeSaludFinanciera = 'Presupuesto justo';
    } else {
      this.saludFinanciera = 'critica';
      this.mensajeSaludFinanciera = '¡Alerta! Tienes más compromisos que ingresos disponibles';
    }
  }

  nombreMes(m: string): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[parseInt(m) - 1] || '';
  }

  irAgregarRapido() {
    this.router.navigate(['/app/expense']);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatearInputMoneda(event: Event, tipo: 'cuenta' | 'deuda' | 'prestamo') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');
    const valorNumerico = Number(raw);
    const valorFormateado = valorNumerico.toLocaleString('es-CO');
    input.value = valorNumerico ? valorFormateado : '';
    if (tipo === 'cuenta') this.nuevaCuenta.valor = valorNumerico;
    else if (tipo === 'deuda') this.nuevaDeuda.valor = valorNumerico;
    else if (tipo === 'prestamo') this.nuevoPrestamo.valor = valorNumerico;
  }

  loadDebts(): void {
    const userId = this.currentUser;
    if (!userId) { this.debts = []; return; }
    this.debtService.getDebts(userId, this.currentYear, this.currentMonth).subscribe({
      next: (data: any) => {
        if (!data) { this.debts = []; return; }
        this.debts = Object.entries(data).map(([id, value]) => ({ id, ...(value as Debt) } as DebtWithId));
      },
      error: () => { this.debts = []; },
    });
  }

  getPendingDebts(): DebtWithId[] {
    return this.debts.filter((d) => d.estado === 'Pendiente');
  }

  togglePaymentStatus(debt: DebtWithId): void {
    if (!debt?.id) return;
    const userId = this.currentUser;
    if (!userId) return;
    const nuevoEstado: 'Pendiente' | 'Pagado' = debt.estado === 'Pendiente' ? 'Pagado' : 'Pendiente';
    const payload: Debt = { acreedor: debt.acreedor, fecha_deuda: debt.fecha_deuda, fecha_pago: debt.fecha_pago, valor: debt.valor, estado: nuevoEstado };
    const estadoAnterior = debt.estado;
    debt.estado = nuevoEstado;
    this.debtService.updateDebt(userId, this.currentYear, this.currentMonth, debt.id, payload).subscribe({
      next: () => this.loadDebts(),
      error: () => { debt.estado = estadoAnterior; },
    });
  }

  openPayInvoiceModal(invoiceId: string) {
    this.payInvoice = this.invoices.find((i) => i.id === invoiceId) || null;
    this.selectedWalletForPayment = '';
    this.isPayInvoiceModalOpen = true;
  }

  closePayInvoiceModal() {
    this.isPayInvoiceModalOpen = false;
    this.payInvoice = null;
    this.selectedWalletForPayment = '';
  }

  getWalletBalance(id: string) {
    const account = this.wallet.find((acc) => acc.id === id);
    return account ? account.valor : 0;
  }

  confirmPayInvoice() {
    if (!this.payInvoice || !this.selectedWalletForPayment) return;
    const account = this.wallet.find((w) => w.id === this.selectedWalletForPayment);
    if (!account) return;
    if (account.valor < this.payInvoice.valor) { alert('Saldo insuficiente'); return; }
    account.valor -= this.payInvoice.valor;
    this.walletService.updateAccount(this.currentUser, this.currentYear, this.currentMonth, account.id, account).subscribe();
    const facturaGasto: Expense = new Expense(this.payInvoice.nombre, CategoriaGasto.Facturas, this.payInvoice.valor, this.payInvoice.valor);
    this.expenseService.addExpense(this.currentUser, this.currentYear, this.currentMonth, facturaGasto).subscribe({
      next: (res: any) => {
        this.payInvoice!.gastoId = res.name || res.id;
        this.payInvoice!.estado = 'Pagada';
        this.invoiceService.updateInvoice(this.currentUser, this.currentYear, this.currentMonth, this.payInvoice!.id, this.payInvoice!).subscribe({
          next: () => { this.closePayInvoiceModal(); this.loadData(); },
        });
      },
    });
  }

  loadInvoices() {
    const userId = this.currentUser;
    const year = this.currentYear;
    const month = this.currentMonth;
    if (!userId || !year || !month) { this.invoices = []; return; }
    this.invoiceService.getInvoices(userId, year, month).subscribe((res: any) => {
      if (!res) { this.invoices = []; return; }
      this.invoices = Object.entries(res).map(([id, item]: [string, any]) => ({ id, ...(item as Invoice), showMenu: false }));
    });
  }

  getSortedInvoices() {
    if (!this.invoices) return [];
    const hoy = new Date();
    return this.invoices
      .filter((inv) => inv.estado !== 'Pagada')
      .sort((a, b) => {
        const fechaA = new Date(a.fechaPago);
        const fechaB = new Date(b.fechaPago);
        const vencidaA = fechaA < hoy;
        const vencidaB = fechaB < hoy;
        if (vencidaA && !vencidaB) return -1;
        if (!vencidaA && vencidaB) return 1;
        return fechaA.getTime() - fechaB.getTime();
      });
  }

  private computeGastosPorCategoria(): void {
    const map = new Map<string, number>();
    for (const g of this.gastos) {
      map.set(g.categoria, (map.get(g.categoria) || 0) + (g.valor || 0));
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    this.gastosPorCategoria = Array.from(map.entries())
      .map(([categoria, t]) => ({
        categoria,
        total: t,
        pct: total > 0 ? Math.round((t / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  private computeTopGastos(): void {
    this.topGastos = [...this.gastos]
      .sort((a, b) => (b.valor || 0) - (a.valor || 0))
      .slice(0, 5);
  }

  private computeTendenciaBalance(): void {
    if (this.monthlyHistory.length < 2) { this.tendenciaBalance = { direccion: 'estable', pct: 0 }; return; }
    const ultimo = this.monthlyHistory[this.monthlyHistory.length - 1];
    const penultimo = this.monthlyHistory[this.monthlyHistory.length - 2];
    if (!penultimo.saldo) { this.tendenciaBalance = { direccion: 'estable', pct: 0 }; return; }
    const diff = ((ultimo.saldo - penultimo.saldo) / Math.abs(penultimo.saldo)) * 100;
    this.tendenciaBalance = {
      direccion: diff > 1 ? 'sube' : diff < -1 ? 'baja' : 'estable',
      pct: Math.abs(Math.round(diff)),
    };
  }
}
