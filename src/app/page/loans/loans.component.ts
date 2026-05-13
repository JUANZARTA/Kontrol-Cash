import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoanService } from '../../services/loans.service';
import { Loan } from '../../models/loans.model';
import { DateService } from '../../services/date.service';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FinanzasService } from '../../services/finanzas.service';
import { WalletService } from '../../services/wallet.service';
import { MatIconModule } from '@angular/material/icon';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

export interface LoanWithId extends Loan {
  id: string;
}

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.css'],
  providers: [DecimalPipe],
})
export default class LoansComponent implements OnInit, OnDestroy {
  // Servicios
  private loanService = inject(LoanService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);
  private authService = inject(AuthService);
  private walletService = inject(WalletService);
  private finanzasService = inject(FinanzasService);

  // Variables para modales de agregar valor y eliminar
  isAddValueModalOpen: boolean = false;
  isDeleteModalOpen: boolean = false;
  selectedIds = new Set<string>();
  showBulkDeleteConfirm = false;
  selectedLoanId: string | null = null;
  loanToDeleteId: string | null = null;
  newValue: number = 0;
  selectedWallet: string = '';

  // Modal devolución al eliminar
  showReturnWalletModal = false;
  selectedReturnWallet = '';

  // Modal de pago
  isPaymentModalOpen = false;
  loanToPay: LoanWithId | null = null;
  selectedPaymentWallet: string = '';
  payLoanMode: 'cuota' | 'todo' = 'cuota';

  toastMessage = '';
  showingToast = false;
  private toastTimeout: any;

  // Datos
  incomes: any[] = [];
  expenses: any[] = [];
  wallet: any[] = [];
  loans: LoanWithId[] = [];

  estadoFinanciero: string = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Edición
  editedLoan: Loan = new Loan('', '', '', 0, 'Pendiente');
  editedLoanTotalCuotas: number = 1;
  editedId: string | null = null;

  // Préstamo nuevo (modal)
  newLoan: Loan = new Loan('', '', '', 0, 'Pendiente');
  newLoanTotalCuotas: number = 1;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';
  private dateSubscription: Subscription | undefined;

  // Referencia a Math para usar en el template
  ngOnInit() {
    // ✅ Suscripción reactiva a año/mes
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadLoans();
        this.loadWallets();
      }
    });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  // Método de ciclo de vida para limpiar la suscripción al destruir el componente
  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  // Método para cargar los préstamos y calcular el estado financiero
  loadLoans() {
    this.loanService
      .getLoans(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.loans = Object.entries(data).map(([id, loan]) => ({
            id,
            ...loan,
          }));

        },
        error: (err) => {
          console.error('Error al cargar préstamos:', err);
        },
      });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  // ======================
  // Modal: Agregar Préstamo
  // ======================
  openModal() {
    this.isModalOpen = true;
    this.newLoan = new Loan('', '', '', 0, 'Pendiente');
    this.selectedWallet = '';

    // ✅ cargar billeteras si aún no están cargadas
    if (!this.wallet.length) {
      this.loadWallets();
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.newLoan = new Loan('', '', '', 0, 'Pendiente');
    this.newLoanTotalCuotas = 1;
    this.selectedWallet = '';
  }

  addLoan() {
    // Validaciones básicas
    if (
      !this.newLoan.deudor ||
      !this.newLoan.fecha_prestamo ||
      !this.newLoan.fecha_pago ||
      this.newLoan.valor <= 0
    ) {
      alert('Por favor completa todos los campos.');
      return;
    }

    // Validar que se seleccionó billetera
    if (!this.selectedWallet) {
      alert('Selecciona la billetera de origen.');
      return;
    }

    // Obtener billetera de origen
    const sourceWallet = this.wallet.find((a) => a.id === this.selectedWallet);
    if (!sourceWallet) {
      alert('Billetera seleccionada no encontrada.');
      return;
    }

    // Validar que haya suficiente saldo
    if (this.newLoan.valor > sourceWallet.valor) {
      alert('El valor excede el saldo disponible de la billetera.');
      return;
    }

    // 1️⃣ Crear el préstamo en backend
    const loanToSave: Loan = {
      ...this.newLoan,
      totalCuotas: Math.max(1, Math.floor(this.newLoanTotalCuotas || 1)),
      cuotasPagadas: 0,
    };

    this.loanService
      .addLoan(this.userId, this.currentYear, this.currentMonth, loanToSave)
      .subscribe({
        next: () => {
          // 2️⃣ Actualizar billetera de origen descontando valor
          const updatedWallet = {
            tipo: sourceWallet.tipo,
            valor: sourceWallet.valor - this.newLoan.valor,
          };

          this.walletService
            .updateAccount(
              this.userId,
              this.currentYear,
              this.currentMonth,
              sourceWallet.id,
              updatedWallet
            )
            .subscribe({
              next: () => {
                this.loadLoans(); // recarga préstamos y billeteras
                this.closeModal(); // cierra modal y limpia formulario
                this.selectedWallet = ''; // limpiar selección
              },
              error: (err: any) =>
                console.error('Error al actualizar billetera:', err),
            });
        },
        error: (err: any) => console.error('Error al agregar préstamo:', err),
      });
  }

  loadWallets() {
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe((data) => {
        this.wallet = Object.entries(data || {}).map(([id, w]) => ({
          id,
          tipo: w.tipo || 'Sin tipo', // mostrar tipo de billetera
          valor: w.valor || 0,
        }));
      });
  }

  // Devuelve el saldo de la billetera seleccionada
  get selectedWalletSaldo(): number {
    const account = this.wallet.find((w) => w.id === this.selectedWallet);
    return account ? account.valor : 0;
  }

  // ======================
  // Modal: Agregar Valor en Préstamo
  // ======================
  openAddModal(id: string) {
    this.selectedLoanId = id;
    this.isAddValueModalOpen = true;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  applyValue(action: 'add' | 'subtract') {
    if (!this.selectedLoanId) return;

    const loan = this.loans.find((l) => l.id === this.selectedLoanId);
    if (!loan) return;

    let finalValue = this.newValue;

    if (action === 'subtract') {
      finalValue = -Math.abs(this.newValue);
    } else {
      finalValue = Math.abs(this.newValue);
    }

    const updatedValue = loan.valor + finalValue;

    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: updatedValue,
      estado: loan.estado,
      totalCuotas: this.getTotalCuotas(loan),
      cuotasPagadas: this.getCuotasPagadas(loan),
    };

    this.loanService
      .updateLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        loan.id,
        updatedLoan
      )
      .subscribe({
        next: () => {
          this.loadLoans();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar préstamo:', err);
        },
      });
  }

  // ======================
  // Modal: Pagado el Préstamo
  // ======================
  openPaymentModal(loan: LoanWithId, mode: 'cuota' | 'todo' = 'cuota') {
    if (loan.estado === 'Pagado') return;
    this.loanToPay = loan;
    this.payLoanMode = mode;
    this.selectedPaymentWallet = '';
    this.isPaymentModalOpen = true;
    if (!this.wallet.length) this.loadWallets();
  }

  getPayModalMonto(): number {
    if (!this.loanToPay) return 0;
    return this.payLoanMode === 'todo'
      ? this.getRemainingAmount(this.loanToPay)
      : this.loanToPay.valor / this.getTotalCuotas(this.loanToPay);
  }

  closePaymentModal() {
    this.isPaymentModalOpen = false;
    this.loanToPay = null;
    this.selectedPaymentWallet = '';
  }

  confirmLoanPayment() {
    if (!this.loanToPay || !this.selectedPaymentWallet) return;

    const loan = this.loanToPay;
    const account = this.wallet.find(w => w.id === this.selectedPaymentWallet);
    if (!account) return;

    const monto = this.getPayModalMonto();
    const totalCuotas = this.getTotalCuotas(loan);
    const cuotasPagadas = this.getCuotasPagadas(loan);
    const nuevasCuotasPagadas = this.payLoanMode === 'todo' ? totalCuotas : cuotasPagadas + 1;

    this.walletService.updateAccount(
      this.userId, this.currentYear, this.currentMonth, account.id,
      { tipo: account.tipo, valor: account.valor + monto }
    ).subscribe({
      next: () => {
        const updatedLoan: Loan = {
          ...loan,
          cuotasPagadas: nuevasCuotasPagadas,
          estado: nuevasCuotasPagadas >= totalCuotas ? 'Pagado' : 'Pendiente',
          lastPaymentWalletId: account.id,
        };
        this.loanService.updateLoan(this.userId, this.currentYear, this.currentMonth, loan.id, updatedLoan)
          .subscribe({
            next: () => {
              this.isPaymentModalOpen = false;
              this.loanToPay = null;
              this.selectedPaymentWallet = '';
              this.loadLoans();
              this.loadWallets();
              this.showToast(`$${this.formatCurrency(monto)} recibidos en ${account.tipo}.`);
            },
          });
      },
      error: () => this.showToast('Error al actualizar la billetera.'),
    });
  }

  // ======================
  // Modal: Editar Préstamo
  // ======================
  openEditModal(id: string) {
    const original = this.loans.find((l) => l.id === id);
    if (!original) return;

    this.editedLoan = new Loan(
      original.deudor,
      original.fecha_prestamo,
      original.fecha_pago,
      original.valor,
      original.estado
    );
    this.editedLoanTotalCuotas = this.getTotalCuotas(original);
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedLoan = new Loan('', '', '', 0, 'Pendiente');
    this.editedLoanTotalCuotas = 1;
    this.editedId = null;
  }

  saveEditedLoan() {
    if (!this.editedId) return;

    const original = this.loans.find((l) => l.id === this.editedId);
    if (!original) return;

    const totalCuotas = Math.max(1, Math.floor(this.editedLoanTotalCuotas || 1));
    const cuotasPagadas = Math.max(0, Math.min(this.getCuotasPagadas(original), totalCuotas));
    const remaining = totalCuotas - cuotasPagadas;

    const updatedLoan: Loan = {
      ...this.editedLoan,
      totalCuotas,
      cuotasPagadas,
      estado: remaining === 0 ? 'Pagado' : 'Pendiente',
    };

    this.loanService
      .updateLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        updatedLoan
      )
      .subscribe({
        next: () => {
          this.loadLoans();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al actualizar préstamo:', err);
        },
      });
  }

  // ======================
  // Modal: Eliminar Préstamo
  // ======================
  openDeleteModal(id: string) {
    this.isDeleteModalOpen = true;
    this.loanToDeleteId = id;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.loanToDeleteId = null;
  }

  confirmDeleteLoan() {
    if (!this.loanToDeleteId) return;
    const loan = this.loans.find(l => l.id === this.loanToDeleteId);
    this.isDeleteModalOpen = false;

    // Si tiene saldo pendiente, preguntar a qué billetera devolver
    if (loan && this.getRemainingAmount(loan) > 0) {
      this.selectedReturnWallet = '';
      this.showReturnWalletModal = true;
      if (!this.wallet.length) this.loadWallets();
    } else {
      this.deleteLoanById(this.loanToDeleteId);
    }
  }

  confirmReturnAndDelete(): void {
    if (!this.loanToDeleteId) return;
    const loan = this.loans.find(l => l.id === this.loanToDeleteId);
    const monto = loan ? this.getRemainingAmount(loan) : 0;

    const finish = () => {
      this.deleteLoanById(this.loanToDeleteId!);
      this.showReturnWalletModal = false;
      this.selectedReturnWallet = '';
    };

    if (this.selectedReturnWallet && monto > 0) {
      const account = this.wallet.find(w => w.id === this.selectedReturnWallet);
      if (account) {
        this.walletService.updateAccount(
          this.userId, this.currentYear, this.currentMonth, account.id,
          { tipo: account.tipo, valor: account.valor + monto }
        ).subscribe({
          next: () => {
            this.loadWallets();
            this.showToast(`$${this.formatCurrency(monto)} devueltos a ${account.tipo}.`);
            finish();
          },
        });
        return;
      }
    }
    finish();
  }

  deleteLoanById(id: string): void {
    this.loanService.deleteLoan(this.userId, this.currentYear, this.currentMonth, id)
      .subscribe({
        next: () => { this.loanToDeleteId = null; this.loadLoans(); },
        error: err => console.error('Error al eliminar préstamo:', err),
      });
  }

  // Método para cambiar el estado de un préstamo
  togglePaymentStatus(loan: LoanWithId) {
    const updatedStatus = (
      loan.estado === 'Pendiente' ? 'Pagado' : 'Pendiente'
    ) as 'Pendiente' | 'Pagado';

    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: loan.valor,
      estado: updatedStatus,
    };

    this.loanService
      .updateLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        loan.id,
        updatedLoan
      )
      .subscribe({
        next: () => {
          this.loadLoans();
        },
        error: (err) => {
          console.error('Error al actualizar estado del préstamo:', err);
        },
      });
  }

  onLoanStatusActionChange(loan: LoanWithId, action: string): void {
    if (action === 'PagarCuota') {
      this.openPaymentModal(loan, 'cuota');
      return;
    }

    if (action === 'Pagado') {
      this.openPaymentModal(loan, 'todo');
      return;
    }

    if (action === 'DeshacerCuota') {
      this.undoAndReturnToWallet(loan);
      return;
    }

    if (action === 'Pendiente') {
      this.setLoanStatus(loan, 'Pendiente');
    }
  }

  private setLoanStatus(loan: LoanWithId, targetStatus: 'Pendiente' | 'Pagado'): void {
    const totalCuotas = this.getTotalCuotas(loan);
    const cuotasPagadas = this.getCuotasPagadas(loan);

    const updatedCuotasPagadas =
      targetStatus === 'Pagado'
        ? totalCuotas
        : (totalCuotas > 1 ? Math.max(0, Math.min(cuotasPagadas, totalCuotas - 1)) : 0);

    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: loan.valor,
      estado: targetStatus,
      totalCuotas,
      cuotasPagadas: updatedCuotasPagadas,
    };

    this.loanService
      .updateLoan(this.userId, this.currentYear, this.currentMonth, loan.id, updatedLoan)
      .subscribe({
        next: () => this.loadLoans(),
        error: (err) => console.error('Error al actualizar estado del préstamo:', err),
      });
  }

  // Método para calcular el total de préstamos pendientes
  getTotalPendingLoans(): number {
    return this.loans
      .filter((loan) => loan.estado === 'Pendiente')
      .reduce((sum, loan) => sum + this.getRemainingAmount(loan), 0);
  }

  getTotalCuotas(loan: LoanWithId): number {
    return Math.max(1, Math.floor(loan.totalCuotas ?? 1));
  }

  getCuotasPagadas(loan: LoanWithId): number {
    return Math.max(0, Math.min(Math.floor(loan.cuotasPagadas ?? 0), this.getTotalCuotas(loan)));
  }

  getValorCuota(loan: LoanWithId): number {
    return loan.valor / this.getTotalCuotas(loan);
  }

  getRemainingAmount(loan: LoanWithId): number {
    if (loan.estado === 'Pagado') return 0;
    const restantes = this.getTotalCuotas(loan) - this.getCuotasPagadas(loan);
    return Math.max(0, restantes * this.getValorCuota(loan));
  }

  getCuotasLabel(loan: LoanWithId): string {
    const total = this.getTotalCuotas(loan);
    const pagadas = this.getCuotasPagadas(loan);
    return `${pagadas}/${total}`;
  }

  payOneInstallment(loan: LoanWithId): void {
    const totalCuotas = this.getTotalCuotas(loan);
    const cuotasPagadas = this.getCuotasPagadas(loan);

    if (cuotasPagadas >= totalCuotas) return;

    const nextCuotasPagadas = cuotasPagadas + 1;
    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: loan.valor,
      estado: nextCuotasPagadas >= totalCuotas ? 'Pagado' : 'Pendiente',
      totalCuotas,
      cuotasPagadas: nextCuotasPagadas,
    };

    this.loanService
      .updateLoan(this.userId, this.currentYear, this.currentMonth, loan.id, updatedLoan)
      .subscribe({
        next: () => this.loadLoans(),
        error: (err) => console.error('Error al pagar cuota del deudor:', err),
      });
  }

  undoOneInstallment(loan: LoanWithId): void {
    const totalCuotas = this.getTotalCuotas(loan);
    const cuotasPagadas = this.getCuotasPagadas(loan);

    if (cuotasPagadas <= 0) return;

    const nextCuotasPagadas = cuotasPagadas - 1;
    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: loan.valor,
      estado: nextCuotasPagadas >= totalCuotas ? 'Pagado' : 'Pendiente',
      totalCuotas,
      cuotasPagadas: nextCuotasPagadas,
    };

    this.loanService
      .updateLoan(this.userId, this.currentYear, this.currentMonth, loan.id, updatedLoan)
      .subscribe({
        next: () => this.loadLoans(),
        error: (err) => console.error('Error al deshacer cuota del deudor:', err),
      });
  }

  undoAndReturnToWallet(loan: LoanWithId): void {
    const cuotasPagadas = this.getCuotasPagadas(loan);
    if (cuotasPagadas <= 0) return;

    const monto = loan.valor / this.getTotalCuotas(loan);
    const updatedLoan: Loan = {
      ...loan,
      cuotasPagadas: cuotasPagadas - 1,
      estado: 'Pendiente',
    };

    const update$ = this.loanService.updateLoan(
      this.userId, this.currentYear, this.currentMonth, loan.id, updatedLoan
    );

    const walletId = loan.lastPaymentWalletId;
    if (walletId) {
      this.walletService.getWallet(this.userId, this.currentYear, this.currentMonth).subscribe({
        next: (data: any) => {
          const entries = Object.entries(data || {}) as [string, any][];
          const entry = entries.find(([id]) => id === walletId);
          if (entry) {
            const [id, w] = entry;
            forkJoin([
              update$,
              this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, id,
                { tipo: w.tipo, valor: w.valor - monto }),
            ]).subscribe({
              next: () => {
                this.loadLoans();
                this.loadWallets();
                this.showToast(`$${this.formatCurrency(monto)} descontados de ${w.tipo}.`);
              },
            });
          } else {
            update$.subscribe({ next: () => this.loadLoans() });
          }
        },
      });
    } else {
      update$.subscribe({ next: () => this.loadLoans() });
    }
  }

  showToast(message: string): void {
    this.toastMessage = message;
    this.showingToast = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => { this.showingToast = false; }, 3000);
  }

  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  onValueInput(event: Event, type: 'new' | 'edit' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;

    if (type === 'new') {
      this.newLoan.valor = value;
    } else if (type === 'edit') {
      this.editedLoan.valor = value;
    } else if (type === 'add') {
      this.newValue = value;
    }

    input.value = this.formatCurrency(value);
  }
  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    this.editedLoan.valor = value;
    input.value = this.formatCurrency(value);
  }

  get hasSelection(): boolean { return this.selectedIds.size > 0; }
  get selectionCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.loans.length > 0 && this.loans.every(l => this.selectedIds.has(l.id)); }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleSelectAll(): void {
    if (this.allSelected) this.selectedIds.clear();
    else this.loans.forEach(l => this.selectedIds.add(l.id));
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds);
    const ops = ids.map(id => this.loanService.deleteLoan(this.userId, this.currentYear, this.currentMonth, id));
    forkJoin(ops).subscribe(() => {
      this.selectedIds.clear();
      this.showBulkDeleteConfirm = false;
      this.loadLoans();
    });
  }

  // loans.component.ts (o el componente donde tienes la tabla)
  getRowAnimationDelay(loan: any, index?: number): string {
    // Si pasas el index desde *ngFor, úsalo directamente
    const i = index ?? this.loans.indexOf(loan);
    // Retorna un delay incremental: 0.1s, 0.2s, 0.3s, ...
    return `${0.1 + i * 0.05}s`;
  }

  get paymentWalletSaldo(): number {
    const account = this.wallet.find(w => w.id === this.selectedPaymentWallet);
    return account ? account.valor : 0;
  }

  get returnWalletSaldo(): number {
    const account = this.wallet.find(w => w.id === this.selectedReturnWallet);
    return account ? account.valor : 0;
  }
}
