import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subscription, forkJoin } from 'rxjs';
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
import { CategoriaGasto } from '../../models/expense.model';

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
  showReopenConfirm = false;
  closeSuccess = false;
  snapshotToDelete: MonthlyCloseSnapshot | null = null;

  preview = {
    wallets: 0,
    savings: 0,
    debts: 0,
    loans: 0,
    invoices: 0,
    expenses: 0,
    mesAnteriorTotal: 0,
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
        expenses: Object.values(expenses || {}).filter(e => e.categoria === CategoriaGasto.Fijo || e.categoria === CategoriaGasto.Variable).length,
        mesAnteriorTotal: Object.values(wallets || {}).reduce((s, w) => s + (w.valor || 0), 0),
      };
      this.isLoading = false;
    });
  }

  executeClose(): void {
    this.showConfirm = false;
    this.isLoading = true;
    this.closeService.executeClose(this.userId, this.currentYear, this.currentMonth).subscribe(() => {
      this.isClosed = true;
      this.closeSuccess = true;
      this.isLoading = false;
      this.snapshots = this.closeService.list(this.userId);
    });
  }

  reopenMonth(): void {
    this.showReopenConfirm = false;
    this.isLoading = true;
    this.closeService.reopenMonth(this.userId, this.currentYear, this.currentMonth).subscribe(() => {
      this.isClosed = false;
      this.closeSuccess = false;
      this.loadState();
    });
  }

  download(snapshot: MonthlyCloseSnapshot): void {
    this.closeService.downloadPdf(snapshot);
  }

  confirmDeleteSnapshot(snapshot: MonthlyCloseSnapshot): void {
    this.snapshotToDelete = snapshot;
  }

  cancelDeleteSnapshot(): void {
    this.snapshotToDelete = null;
  }

  deleteSnapshot(): void {
    if (!this.snapshotToDelete) return;
    this.closeService.deleteSnapshot(this.userId, this.snapshotToDelete.period);
    this.snapshots = this.closeService.list(this.userId);
    this.snapshotToDelete = null;
  }

  formatCurrency(v: number): string {
    return this.decimalPipe.transform(v, '1.0-0') || '0';
  }
}
