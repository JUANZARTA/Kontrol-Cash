import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { DateService } from '../../services/date.service';
import { MonthlyCloseService } from '../../services/monthly-close.service';
import { WalletService } from '../../services/wallet.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeService } from '../../services/income.service';
import { DebtService } from '../../services/debts.service';
import { LoanService } from '../../services/loans.service';
import { InvoiceService } from '../../services/invoice.service';
import { SavingsService } from '../../services/savings.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { MonthlyCloseSnapshot } from '../../models/monthly-close.model';
import { Income } from '../../models/income.model';
import { Expense } from '../../models/expense.model';
import { Debt } from '../../models/debt.model';
import { Loan } from '../../models/loans.model';
import { Saving } from '../../models/savings.model';
import { Invoice } from '../../models/invoice.model';

@Component({
  selector: 'app-month-close',
  standalone: true,
  imports: [CommonModule, ConfirmModalComponent],
  templateUrl: './month-close.component.html',
  providers: [DecimalPipe],
})
export default class MonthCloseComponent implements OnInit, OnDestroy {
  private dateService = inject(DateService);
  private closeService = inject(MonthlyCloseService);
  private walletService = inject(WalletService);
  private expenseService = inject(ExpenseService);
  private incomeService = inject(IncomeService);
  private debtService = inject(DebtService);
  private loanService = inject(LoanService);
  private invoiceService = inject(InvoiceService);
  private savingsService = inject(SavingsService);
  private decimalPipe = inject(DecimalPipe);

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;
  currentYear = '';
  currentMonth = '';

  isLoading = false;
  isClosed = false;
  showConfirm = false;
  closeSuccess = false;

  preview = {
    wallets: 0,
    savings: 0,
    debts: 0,
    loans: 0,
    invoices: 0,
    expenses: 0,
    incomeTotal: 0,
  };

  snapshots: MonthlyCloseSnapshot[] = [];
  private dateSub?: Subscription;

  ngOnInit(): void {
    this.dateSub = this.dateService.selectedDate$.subscribe(date => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadState();
      }
    });
    this.snapshots = this.closeService.list(this.userId);
  }

  ngOnDestroy(): void {
    this.dateSub?.unsubscribe();
  }

  get periodLabel(): string {
    if (!this.currentYear || !this.currentMonth) return '';
    const date = new Date(parseInt(this.currentYear), parseInt(this.currentMonth) - 1, 1);
    return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }

  get nextPeriodLabel(): string {
    if (!this.currentYear || !this.currentMonth) return '';
    const next = this.closeService.getNextPeriod(this.currentYear, this.currentMonth);
    const date = new Date(parseInt(next.year), parseInt(next.month) - 1, 1);
    return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }

  loadState(): void {
    this.isLoading = true;
    this.closeSuccess = false;

    forkJoin({
      closed: this.closeService.isMonthClosed(this.userId, this.currentYear, this.currentMonth),
      wallets: this.walletService.getWallet(this.userId, this.currentYear, this.currentMonth),
      expenses: this.expenseService.getExpenses(this.userId, this.currentYear, this.currentMonth),
      incomes: this.incomeService.getIncomes(this.userId, this.currentYear, this.currentMonth),
      debts: this.debtService.getDebts(this.userId, this.currentYear, this.currentMonth),
      loans: this.loanService.getLoans(this.userId, this.currentYear, this.currentMonth),
      invoices: this.invoiceService.getInvoices(this.userId, this.currentYear, this.currentMonth),
      savings: this.savingsService.getSavings(this.userId, this.currentYear, this.currentMonth),
    }).subscribe(({ closed, wallets, expenses, incomes, debts, loans, invoices, savings }) => {
      this.isClosed = closed;
      this.preview = {
        wallets: Object.keys(wallets || {}).length,
        savings: Object.keys(savings || {}).length,
        debts: Object.values(debts || {}).filter(d => d.estado === 'Pendiente').length,
        loans: Object.values(loans || {}).filter(l => l.estado === 'Pendiente').length,
        invoices: Object.keys(invoices || {}).length,
        expenses: Object.values(expenses || {}).filter(e => e.descripcion !== 'Gasolina').length,
        incomeTotal: Object.values(incomes || {}).reduce((s, i) => s + (i.valor || 0), 0),
      };
      this.isLoading = false;
    });
  }

  executeClose(): void {
    this.showConfirm = false;
    this.isLoading = true;
    const next = this.closeService.getNextPeriod(this.currentYear, this.currentMonth);

    forkJoin({
      wallets: this.walletService.getWallet(this.userId, this.currentYear, this.currentMonth),
      expenses: this.expenseService.getExpenses(this.userId, this.currentYear, this.currentMonth),
      incomes: this.incomeService.getIncomes(this.userId, this.currentYear, this.currentMonth),
      debts: this.debtService.getDebts(this.userId, this.currentYear, this.currentMonth),
      loans: this.loanService.getLoans(this.userId, this.currentYear, this.currentMonth),
      invoices: this.invoiceService.getInvoices(this.userId, this.currentYear, this.currentMonth),
      savings: this.savingsService.getSavings(this.userId, this.currentYear, this.currentMonth),
      mesAnteriorId: this.closeService.getMesAnteriorId(this.userId, next.year, next.month),
    }).pipe(
      map(data => {
        const ops: any[] = [];

        // 1. Billeteras → pasan completas con su saldo
        Object.values(data.wallets || {}).forEach(w => {
          ops.push(this.walletService.addAccount(this.userId, next.year, next.month,
            { tipo: w.tipo, valor: w.valor }));
        });

        // 2. Alcancías → pasan con saldo actual, sin movimientos del mes anterior
        Object.values(data.savings || {}).forEach(s => {
          ops.push(this.savingsService.addSaving(this.userId, next.year, next.month,
            new Saving(s.tipo, s.valor, s.nombre, s.metaAhorro)));
        });

        // 3. Deudas → solo pendientes, cuotas intactas
        Object.values(data.debts || {}).filter(d => d.estado === 'Pendiente').forEach(d => {
          ops.push(this.debtService.addDebt(this.userId, next.year, next.month,
            new Debt(d.acreedor, d.fecha_deuda, d.fecha_pago, d.valor, 'Pendiente',
              d.totalCuotas, d.cuotasPagadas)));
        });

        // 4. Deudores → solo pendientes, cuotas intactas
        Object.values(data.loans || {}).filter(l => l.estado === 'Pendiente').forEach(l => {
          ops.push(this.loanService.addLoan(this.userId, next.year, next.month,
            new Loan(l.deudor, l.fecha_prestamo, l.fecha_pago, l.valor, 'Pendiente',
              l.totalCuotas, l.cuotasPagadas)));
        });

        // 5. Facturas → todas en estado Pendiente, mismo día/año pero mes siguiente
        const advanceMonth = (dateStr: string, y: string, m: string): string => {
          if (!dateStr) return dateStr;
          const day = new Date(dateStr).getDate();
          const adjusted = new Date(parseInt(y), parseInt(m) - 1, day);
          return adjusted.toISOString().split('T')[0];
        };
        (Object.values(data.invoices || {}) as Invoice[]).forEach(inv => {
          ops.push(this.invoiceService.addInvoice(this.userId, next.year, next.month,
            { nombre: inv.nombre, fechaPago: advanceMonth(inv.fechaPago, next.year, next.month), valor: inv.valor, estado: 'Pendiente' }));
        });

        // 6. Gastos → sin Gasolina, valor gastado en 0, estimación intacta, sin adjuntos
        Object.values(data.expenses || {}).filter(e => e.descripcion !== 'Gasolina').forEach(exp => {
          ops.push(this.expenseService.addExpense(this.userId, next.year, next.month,
            new Expense(exp.descripcion, exp.categoria, 0, exp.estimacion)));
        });

        // 7. Ingresos del mes anterior → un solo ingreso "Mes anterior"
        const incomeTotal = Object.values(data.incomes || {}).reduce((s, i) => s + (i.valor || 0), 0);
        const mesAnteriorIncome = new Income('Mes anterior', 'Otro', incomeTotal);
        if (data.mesAnteriorId) {
          ops.push(this.incomeService.updateIncome(this.userId, next.year, next.month,
            data.mesAnteriorId, mesAnteriorIncome));
        } else {
          ops.push(
            this.incomeService.addIncome(this.userId, next.year, next.month, mesAnteriorIncome).pipe(
              switchMap((res: any) => {
                const newId = res?.name;
                return newId
                  ? this.closeService.setMesAnteriorId(this.userId, next.year, next.month, newId)
                  : of(null);
              })
            )
          );
        }

        // 8. Marcar mes como cerrado en Firebase
        ops.push(this.closeService.markMonthClosed(this.userId, this.currentYear, this.currentMonth));

        const expenseTotal = Object.values(data.expenses || {}).reduce((s, e) => s + (e.valor || 0), 0);
        const debtPending = Object.values(data.debts || {})
          .filter(d => d.estado === 'Pendiente')
          .reduce((s, d) => s + (d.valor || 0), 0);

        return { ops, snapshot: { incomeTotal, expenseTotal, debtPending } };
      }),
      switchMap(({ ops, snapshot }) =>
        forkJoin(ops.length ? ops : [of(null)]).pipe(map(() => snapshot))
      )
    ).subscribe(({ incomeTotal, expenseTotal, debtPending }) => {
      this.closeService.closeMonth(this.userId, {
        period: `${this.currentYear}-${this.currentMonth}`,
        closedAt: new Date().toISOString(),
        totals: {
          income: incomeTotal,
          expense: expenseTotal,
          net: incomeTotal - expenseTotal,
          debtPending,
        },
        categories: {},
        pdf: { path: '', size: 0, sha256: '' },
      });
      this.isClosed = true;
      this.closeSuccess = true;
      this.isLoading = false;
      this.snapshots = this.closeService.list(this.userId);
    });
  }

  download(snapshot: MonthlyCloseSnapshot): void {
    this.closeService.downloadPdf(snapshot);
  }

  formatCurrency(v: number): string {
    return this.decimalPipe.transform(v, '1.0-0') || '0';
  }
}
