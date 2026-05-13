import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DebtService } from '../../services/debts.service';
import { Debt } from '../../models/debt.model';
import { DateService } from '../../services/date.service';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { DebtPriorityService, RankedDebt } from '../../services/debt-priority.service';
import { WalletService } from '../../services/wallet.service';
import { ExpenseService } from '../../services/expense.service';
import { Expense, CategoriaGasto } from '../../models/expense.model';

export interface DebtWithId extends Debt {
  id: string;
}

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.css'],
  providers: [DecimalPipe],
})
export default class DebtsComponent implements OnInit, OnDestroy {
  // Servicios
  private debtService = inject(DebtService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);
  private authService = inject(AuthService);
  private finanzasService = inject(FinanzasService);
  private debtPriorityService = inject(DebtPriorityService);
  private walletService = inject(WalletService);
  private expenseService = inject(ExpenseService);

  // Variables
  selectedDebtId: string | null = null;

  wallet: any[] = [];

  // Modal pagar deuda
  showPayDebtModal = false;
  payDebtTarget: DebtWithId | null = null;
  selectedWalletForDebt = '';
  payDebtMode: 'cuota' | 'todo' = 'cuota';

  toastMessage = '';
  showingToast = false;
  private toastTimeout: any;

  // Estado financiero
  estadoFinanciero: string = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Nuevo Modal de Eliminar
  isDeleteModalOpen = false;
  selectedIds = new Set<string>();
  showBulkDeleteConfirm = false;
  debtToDeleteId: string | null = null;

  // Nuevo Modal de Agregar Valor
  isAddValueModalOpen = false;
  newValue: number = 0;

  // Datos
  debts: DebtWithId[] = [];
  rankedDebts: RankedDebt[] = [];

  // Modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Edición
  editedDebt: Debt = new Debt('', '', '', 0, 'Pendiente');
  editedDebtTotalCuotas: number = 1;
  editedId: string | null = null;

  // Deuda nueva
  newDebt: Debt = new Debt('', '', '', 0, 'Pendiente');
  newDebtTotalCuotas: number = 1;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';
  private dateSubscription: Subscription | undefined; // ✅ Nuevo

  ngOnInit() {
    // ✅ Escuchar cambios en el año y mes seleccionados
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadDebts();
      }
    });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  // ======================
  // Obtener deudas
  // ======================
  loadDebts() {
    this.debtService
      .getDebts(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.debts = Object.entries(data).map(([id, d]) => ({ id, ...d }));
          this.rankedDebts = this.debtPriorityService.rank(this.debts);

        },
        error: (err) => {
          console.error('Error al cargar deudas:', err);
        },
      });
  }

  // ======================
  // Modal: Agregar Deuda
  // ======================
  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.newDebt = new Debt('', '', '', 0, 'Pendiente');
    this.newDebtTotalCuotas = 1;
  }

  addDebt() {
    if (
      !this.newDebt.acreedor ||
      !this.newDebt.fecha_deuda ||
      !this.newDebt.fecha_pago ||
      this.newDebt.valor <= 0
    ) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.debtService
      .addDebt(this.userId, this.currentYear, this.currentMonth, {
        ...this.newDebt,
        totalCuotas: Math.max(1, Math.floor(this.newDebtTotalCuotas || 1)),
        cuotasPagadas: 0,
      })
      .subscribe({
        next: () => {
          this.loadDebts();
          this.closeModal();
        },
      });
  }

  // ======================
  // Modal: Agregar valor en Deuda
  // ======================
  openAddModal(id: string) {
    this.selectedDebtId = id;
    this.isAddValueModalOpen = true;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  saveNewValue() {
    if (!this.selectedDebtId) return;

    const debt = this.debts.find((d) => d.id === this.selectedDebtId);
    if (!debt) return;

    const updatedValue = debt.valor + this.newValue;

    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: updatedValue,
      estado: debt.estado,
      totalCuotas: this.getTotalCuotas(debt),
      cuotasPagadas: this.getCuotasPagadas(debt),
      interestRate: debt.interestRate,
      penaltyFee: debt.penaltyFee,
      minPayment: debt.minPayment,
      daysPastDue: debt.daysPastDue,
    };

    this.debtService
      .updateDebt(
        this.userId,
        this.currentYear,
        this.currentMonth,
        debt.id,
        updatedDebt
      )
      .subscribe({
        next: () => {
          this.loadDebts();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar valor de deuda:', err);
        },
      });
  }

  // ======================
  // Modal: Editar Deuda
  // ======================
  openEditModal(id: string) {
    const original = this.debts.find((d) => d.id === id);
    if (!original) return;

    this.editedDebt = new Debt(
      original.acreedor,
      original.fecha_deuda,
      original.fecha_pago,
      original.valor,
      original.estado
    );
    this.editedDebtTotalCuotas = this.getTotalCuotas(original);
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedDebt = new Debt('', '', '', 0, 'Pendiente');
    this.editedDebtTotalCuotas = 1;
    this.editedId = null;
  }

  saveEditedDebt() {
    if (!this.editedId) return;

    const original = this.debts.find((d) => d.id === this.editedId);
    if (!original) return;

    const totalCuotas = Math.max(1, Math.floor(this.editedDebtTotalCuotas || 1));
    const cuotasPagadas = Math.max(0, Math.min(this.getCuotasPagadas(original), totalCuotas));
    const remaining = totalCuotas - cuotasPagadas;

    const updatedDebt: Debt = {
      ...this.editedDebt,
      totalCuotas,
      cuotasPagadas,
      estado: remaining === 0 ? 'Pagado' : 'Pendiente',
      interestRate: original.interestRate,
      penaltyFee: original.penaltyFee,
      minPayment: original.minPayment,
      daysPastDue: original.daysPastDue,
    };

    this.debtService
      .updateDebt(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        updatedDebt
      )
      .subscribe({
        next: () => {
          this.loadDebts();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al actualizar deuda:', err);
        },
      });
  }

  // ======================
  // Eliminar
  // ======================
  deleteDebt(id: string) {
    const confirmDelete = confirm('¿Estás seguro de eliminar esta deuda?');
    if (!confirmDelete) return;

    this.debtService
      .deleteDebt(this.userId, this.currentYear, this.currentMonth, id)
      .subscribe({
        next: () => {
          this.loadDebts();
        },
        error: (err) => {
          console.error('Error al eliminar deuda:', err);
        },
      });
  }

  openDeleteModal(id: string) {
    this.isDeleteModalOpen = true;
    this.debtToDeleteId = id;
  }

  confirmDeleteDebt() {
    if (!this.debtToDeleteId) return;

    this.debtService
      .deleteDebt(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.debtToDeleteId
      )
      .subscribe({
        next: () => {
          this.loadDebts();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error al eliminar deuda:', err);
        },
      });
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.debtToDeleteId = null;
  }

  // ======================
  // Estado
  // ======================
  togglePaymentStatus(debt: DebtWithId) {
    const totalCuotas = this.getTotalCuotas(debt);
    const cuotasPagadas = this.getCuotasPagadas(debt);
    const updatedStatus = (debt.estado === 'Pendiente' ? 'Pagado' : 'Pendiente') as 'Pendiente' | 'Pagado';

    const updatedCuotasPagadas =
      updatedStatus === 'Pagado'
        ? totalCuotas
        : (totalCuotas > 1 ? Math.max(0, Math.min(cuotasPagadas, totalCuotas - 1)) : 0);

    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: debt.valor,
      estado: updatedStatus,
      totalCuotas,
      cuotasPagadas: updatedCuotasPagadas,
      interestRate: debt.interestRate,
      penaltyFee: debt.penaltyFee,
      minPayment: debt.minPayment,
      daysPastDue: debt.daysPastDue,
    };

    this.debtService
      .updateDebt(
        this.userId,
        this.currentYear,
        this.currentMonth,
        debt.id,
        updatedDebt
      )
      .subscribe({
        next: () => {
          this.loadDebts();
        },

        error: (err) => {
          console.error('Error al cambiar estado de la deuda:', err);
        },
      });
  }

  // ======================
  // Utilidades
  // ======================
  getTotalPendingDebts(): number {
    return this.debts
      .filter((debt) => debt.estado === 'Pendiente')
      .reduce((sum, debt) => sum + this.getRemainingAmount(debt), 0);
  }

  getTotalCuotas(debt: DebtWithId): number {
    return Math.max(1, Math.floor(debt.totalCuotas ?? 1));
  }

  getCuotasPagadas(debt: DebtWithId): number {
    return Math.max(0, Math.min(Math.floor(debt.cuotasPagadas ?? 0), this.getTotalCuotas(debt)));
  }

  getValorCuota(debt: DebtWithId): number {
    return debt.valor / this.getTotalCuotas(debt);
  }

  getRemainingAmount(debt: DebtWithId): number {
    if (debt.estado === 'Pagado') return 0;
    const restantes = this.getTotalCuotas(debt) - this.getCuotasPagadas(debt);
    return Math.max(0, restantes * this.getValorCuota(debt));
  }

  getCuotasLabel(debt: DebtWithId): string {
    const total = this.getTotalCuotas(debt);
    const pagadas = this.getCuotasPagadas(debt);
    return `${pagadas}/${total}`;
  }

  payOneInstallment(debt: DebtWithId): void {
    const totalCuotas = this.getTotalCuotas(debt);
    const cuotasPagadas = this.getCuotasPagadas(debt);

    if (cuotasPagadas >= totalCuotas) return;

    const nextCuotasPagadas = cuotasPagadas + 1;
    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: debt.valor,
      estado: nextCuotasPagadas >= totalCuotas ? 'Pagado' : 'Pendiente',
      totalCuotas,
      cuotasPagadas: nextCuotasPagadas,
      interestRate: debt.interestRate,
      penaltyFee: debt.penaltyFee,
      minPayment: debt.minPayment,
      daysPastDue: debt.daysPastDue,
    };

    this.debtService
      .updateDebt(this.userId, this.currentYear, this.currentMonth, debt.id, updatedDebt)
      .subscribe({
        next: () => this.loadDebts(),
        error: (err) => console.error('Error al pagar cuota de deuda:', err),
      });
  }

  onDebtStatusActionChange(debt: DebtWithId, action: string): void {
    if (action === 'PagarCuota') {
      this.openPayDebtModal(debt.id, 'cuota');
      return;
    }

    if (action === 'Pagado') {
      this.openPayDebtModal(debt.id, 'todo');
      return;
    }

    if (action === 'DeshacerCuota') {
      this.undoAndDeleteExpense(debt);
      return;
    }

    if (action === 'Pendiente') {
      this.setDebtStatus(debt, 'Pendiente');
    }
  }

  private setDebtStatus(debt: DebtWithId, targetStatus: 'Pendiente' | 'Pagado'): void {
    const totalCuotas = this.getTotalCuotas(debt);
    const cuotasPagadas = this.getCuotasPagadas(debt);

    const updatedCuotasPagadas =
      targetStatus === 'Pagado'
        ? totalCuotas
        : (totalCuotas > 1 ? Math.max(0, Math.min(cuotasPagadas, totalCuotas - 1)) : 0);

    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: debt.valor,
      estado: targetStatus,
      totalCuotas,
      cuotasPagadas: updatedCuotasPagadas,
      interestRate: debt.interestRate,
      penaltyFee: debt.penaltyFee,
      minPayment: debt.minPayment,
      daysPastDue: debt.daysPastDue,
    };

    this.debtService
      .updateDebt(this.userId, this.currentYear, this.currentMonth, debt.id, updatedDebt)
      .subscribe({
        next: () => this.loadDebts(),
        error: (err) => console.error('Error al cambiar estado de la deuda:', err),
      });
  }

  undoOneInstallment(debt: DebtWithId): void {
    const totalCuotas = this.getTotalCuotas(debt);
    const cuotasPagadas = this.getCuotasPagadas(debt);

    if (cuotasPagadas <= 0) return;

    const nextCuotasPagadas = cuotasPagadas - 1;
    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: debt.valor,
      estado: nextCuotasPagadas >= totalCuotas ? 'Pagado' : 'Pendiente',
      totalCuotas,
      cuotasPagadas: nextCuotasPagadas,
      interestRate: debt.interestRate,
      penaltyFee: debt.penaltyFee,
      minPayment: debt.minPayment,
      daysPastDue: debt.daysPastDue,
    };

    this.debtService
      .updateDebt(this.userId, this.currentYear, this.currentMonth, debt.id, updatedDebt)
      .subscribe({
        next: () => this.loadDebts(),
        error: (err) => console.error('Error al deshacer cuota de deuda:', err),
      });
  }

  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  onValueInput(event: Event, type: 'new' | 'edit' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || null;

    if (type === 'new') {
      this.newDebt.valor = value ?? 0;
    } else if (type === 'edit') {
      this.editedDebt.valor = value ?? 0;
    } else if (type === 'add') {
      this.newValue = value ?? 0;
    }

    input.value = this.formatCurrency(value ?? 0);
  }

  applyValue(action: 'add' | 'subtract') {
    if (!this.selectedDebtId) return;

    const debt = this.debts.find((d) => d.id === this.selectedDebtId);
    if (!debt) return;

    let finalValue = this.newValue;

    if (action === 'subtract') {
      finalValue = -Math.abs(this.newValue); // asegúrate que sea negativo
    } else {
      finalValue = Math.abs(this.newValue); // asegúrate que sea positivo
    }

    const updatedValue = debt.valor + finalValue;

    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: updatedValue,
      estado: debt.estado,
      totalCuotas: this.getTotalCuotas(debt),
      cuotasPagadas: this.getCuotasPagadas(debt),
      interestRate: debt.interestRate,
      penaltyFee: debt.penaltyFee,
      minPayment: debt.minPayment,
      daysPastDue: debt.daysPastDue,
    };

    this.debtService
      .updateDebt(
        this.userId,
        this.currentYear,
        this.currentMonth,
        debt.id,
        updatedDebt
      )
      .subscribe({
        next: () => {
          this.loadDebts();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar deuda:', err);
        },
      });
  }
  // ======================
  // Pagar deuda desde billetera
  // ======================
  openPayDebtModal(id: string, mode: 'cuota' | 'todo' = 'cuota'): void {
    const debt = this.debts.find(d => d.id === id);
    if (!debt || debt.estado === 'Pagado') return;
    this.payDebtTarget = debt;
    this.payDebtMode = mode;
    this.selectedWalletForDebt = '';
    this.showPayDebtModal = true;
    this.loadWallet();
  }

  closePayDebtModal(): void {
    this.showPayDebtModal = false;
    this.payDebtTarget = null;
    this.selectedWalletForDebt = '';
  }

  private loadWallet(): void {
    this.walletService.getWallet(this.userId, this.currentYear, this.currentMonth).subscribe({
      next: (data) => {
        this.wallet = Object.entries(data || {}).map(([id, w]: [string, any]) => ({ id, tipo: w.tipo, valor: w.valor }));
      },
    });
  }

  getWalletBalance(walletId: string): string {
    const w = this.wallet.find(x => x.id === walletId);
    return w ? this.formatCurrency(w.valor) : '0';
  }

  getCuotaMonto(debt: DebtWithId): number {
    return debt.valor / this.getTotalCuotas(debt);
  }

  getPayModalMonto(): number {
    if (!this.payDebtTarget) return 0;
    return this.payDebtMode === 'todo'
      ? this.getRemainingAmount(this.payDebtTarget)
      : this.getCuotaMonto(this.payDebtTarget);
  }

  confirmPayDebt(): void {
    if (!this.payDebtTarget || !this.selectedWalletForDebt) return;

    const debt = this.payDebtTarget;
    const account = this.wallet.find(w => w.id === this.selectedWalletForDebt);
    if (!account) return;

    const totalCuotas = this.getTotalCuotas(debt);
    const cuotasPagadas = this.getCuotasPagadas(debt);
    const monto = this.getPayModalMonto();

    if (account.valor < monto) {
      this.showToast('Saldo insuficiente en la billetera seleccionada.');
      return;
    }

    let descripcion: string;
    let nuevasCuotasPagadas: number;

    if (this.payDebtMode === 'todo') {
      descripcion = debt.acreedor;
      nuevasCuotasPagadas = totalCuotas;
    } else {
      const nextCuota = cuotasPagadas + 1;
      descripcion = totalCuotas > 1
        ? `Cuota ${debt.acreedor} (${nextCuota}/${totalCuotas})`
        : debt.acreedor;
      nuevasCuotasPagadas = nextCuota;
    }

    const nuevoGasto = new Expense(descripcion, CategoriaGasto.Deuda, monto, monto);
    account.valor -= monto;

    this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, account.id, { tipo: account.tipo, valor: account.valor })
      .subscribe({
        next: () => {
          this.expenseService.addExpense(this.userId, this.currentYear, this.currentMonth, nuevoGasto)
            .subscribe({
              next: () => {
                const updatedDebt: Debt = {
                  ...debt,
                  cuotasPagadas: nuevasCuotasPagadas,
                  estado: nuevasCuotasPagadas >= totalCuotas ? 'Pagado' : 'Pendiente',
                  lastPaymentWalletId: account.id,
                };
                this.debtService.updateDebt(this.userId, this.currentYear, this.currentMonth, debt.id, updatedDebt)
                  .subscribe({
                    next: () => {
                      this.closePayDebtModal();
                      this.loadDebts();
                      this.showToast(`$${this.formatCurrency(monto)} pagados desde ${account.tipo}.`);
                    },
                  });
              },
            });
        },
        error: () => this.showToast('Error al actualizar la billetera.'),
      });
  }

  undoAndDeleteExpense(debt: DebtWithId): void {
    const cuotasPagadas = this.getCuotasPagadas(debt);
    if (cuotasPagadas <= 0) return;

    const totalCuotas = this.getTotalCuotas(debt);
    const montoDevolver = this.getCuotaMonto(debt);
    const descripcionBuscada = totalCuotas > 1
      ? `Cuota ${debt.acreedor} (${cuotasPagadas}/${totalCuotas})`
      : debt.acreedor;

    this.expenseService.getExpenses(this.userId, this.currentYear, this.currentMonth).subscribe({
      next: (data: any) => {
        const entries = Object.entries(data || {}) as [string, any][];
        const match = entries.find(([, e]) =>
          e.categoria === CategoriaGasto.Deuda && e.descripcion === descripcionBuscada
        );

        const updatedDebt: Debt = {
          ...debt,
          cuotasPagadas: cuotasPagadas - 1,
          estado: 'Pendiente',
        };

        const ops: any[] = [
          this.debtService.updateDebt(this.userId, this.currentYear, this.currentMonth, debt.id, updatedDebt),
        ];

        if (match) {
          ops.push(this.expenseService.deleteExpense(this.userId, this.currentYear, this.currentMonth, match[0]));
        }

        // Devolver dinero a la billetera usada si la conocemos
        const walletId = debt.lastPaymentWalletId;
        if (walletId) {
          this.walletService.getWallet(this.userId, this.currentYear, this.currentMonth).subscribe({
            next: (walletData: any) => {
              const entries = Object.entries(walletData || {}) as [string, any][];
              const walletEntry = entries.find(([id]) => id === walletId);
              if (walletEntry) {
                const [id, w] = walletEntry;
                ops.push(this.walletService.updateAccount(
                  this.userId, this.currentYear, this.currentMonth, id,
                  { tipo: w.tipo, valor: w.valor + montoDevolver }
                ));
              }
              forkJoin(ops).subscribe({ next: () => { this.loadDebts(); this.showToast(`$${this.formatCurrency(montoDevolver)} devueltos a la billetera.`); } });
            },
          });
        } else {
          forkJoin(ops).subscribe({ next: () => this.loadDebts() });
        }
      },
    });
  }

  showToast(message: string): void {
    this.toastMessage = message;
    this.showingToast = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => { this.showingToast = false; }, 3000);
  }

  getRowAnimationDelay(item: any, index?: number): string {
    const i = index ?? this.debts.indexOf(item);
    return `${0.1 + i * 0.05}s`;
  }

  get hasSelection(): boolean { return this.selectedIds.size > 0; }
  get selectionCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.debts.length > 0 && this.debts.every(d => this.selectedIds.has(d.id)); }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleSelectAll(): void {
    if (this.allSelected) this.selectedIds.clear();
    else this.debts.forEach(d => this.selectedIds.add(d.id));
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds);
    const ops = ids.map(id => this.debtService.deleteDebt(this.userId, this.currentYear, this.currentMonth, id));
    forkJoin(ops).subscribe(() => {
      this.selectedIds.clear();
      this.showBulkDeleteConfirm = false;
      this.loadDebts();
    });
  }
}
