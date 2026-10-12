import { Component, OnInit, inject, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { WalletAccount, WalletMovementWithId } from '../../models/wallet.model';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LoanService } from '../../services/loans.service';
import { DebtService } from '../../services/debts.service';
import { IncomeService } from '../../services/income.service';
import { ExpenseService } from '../../services/expense.service';
import { Loan } from '../../models/loans.model';
import { Debt } from '../../models/debt.model';
import { Income } from '../../models/income.model';
import { Expense } from '../../models/expense.model';
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu: boolean;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.css'],
  providers: [DecimalPipe],
})
export default class WalletComponent implements OnInit, OnDestroy {
  private walletService = inject(WalletService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);
  private authService = inject(AuthService);
  private loanService = inject(LoanService);
  private debtService = inject(DebtService);
  private incomeService = inject(IncomeService);
  private expenseService = inject(ExpenseService);
  private finanzasService = inject(FinanzasService);

  // Variables para modales de agregar valor y eliminar
  isAddValueModalOpen: boolean = false;
  isDeleteModalOpen: boolean = false;
  isEmptyModalOpen: boolean = false;
  selectedAccountId: string | null = null;
  accountToDeleteId: string | null = null;
  accountToEmptyId: string | null = null;
  newValue: number = 0;

  // Datos
  wallet: WalletAccountWithId[] = [];
  loans: Loan[] = [];
  debts: Debt[] = [];
  incomes: Income[] = [];
  expenses: Expense[] = [];

  // Variables para transacción
  sourceWalletId: string = '';
  sourceWallet: WalletAccountWithId | undefined;

  // Modal de historial de movimientos
  isMovementsModalOpen = false;
  movementsWalletLabel = '';
  movimientos: WalletMovementWithId[] = [];
  isLoadingMovimientos = false;

  // Modal de transaccion
  isTransactionModalOpen = false;
  selectedWallet = '';
  assignedValue: number | null = null;
  transferMode: 'all' | 'custom' = 'all';
  totalDisponible = 20000; // Valor quemado por ahora

  // Variables para manejar el estado de los modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Variables para manejar la cuenta nueva y editada
  newAccount: WalletAccount = new WalletAccount('', 0);
  editedAccount: WalletAccount = new WalletAccount('', 0);
  editedId: string | null = null;

  // Variables para manejar el estado de la cartera
  estadoFinanciero: string = 'Cargando...';
  estadoFinancieroColor: 'rojo' | 'azul' | 'verde' = 'verde';

  cuadreDescuadreWallet: number = 0;
  estadoCartera: string = '';

  // Referencia a Math para usar en el template
  Math = Math;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';
  private dateSubscription: Subscription | undefined;

  // Método de ciclo de vida para iniciar el componente y suscribir a cambios de fecha
  ngOnInit() {
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadAllData();
      }
    });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  // Método para limpiar suscripciones al destruir el componente
  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  // Método para cargar todos los datos necesarios y calcular el cuadre
  loadAllData() {
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.wallet = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item, showMenu: false })
          );
          this.checkLowFunds();
          this.ensureDefaultWallet();
        },
      });

    this.loanService
      .getLoans(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.loans = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item })
          );
        },
      });

    this.debtService
      .getDebts(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.debts = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item })
          );
        },
      });

    this.incomeService
      .getIncomes(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.incomes = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item })
          );
        },
      });

    this.expenseService
      .getExpenses(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.expenses = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item })
          );
        },
      });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  // Método para revisar si el total es bajo
  checkLowFunds() {
    this.getTotalWallet();
  }

  // Crea la cuenta "Monedero" por defecto (fijo: true) si todavía no existe en el mes actual.
  // Se identifica por el flag `fijo`, no por el nombre "tipo", para que el usuario la pueda
  // renombrar sin perder la protección contra eliminación.
  private isEnsuringDefaultWallet = false;

  private ensureDefaultWallet(): void {
    const hasDefault = this.wallet.some((a) => a.fijo === true);
    if (hasDefault || this.isEnsuringDefaultWallet) return;

    this.isEnsuringDefaultWallet = true;
    this.walletService
      .addAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        new WalletAccount('Monedero', 0, true)
      )
      .subscribe({
        next: () => {
          this.isEnsuringDefaultWallet = false;
          this.loadAllData();
        },
        error: (err) => {
          this.isEnsuringDefaultWallet = false;
          console.error('Error al crear la cuenta Monedero por defecto:', err);
        },
      });
  }

  // ======================
  // Modal: Agregar Cuenta
  // ======================
  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.newAccount = new WalletAccount('', 0);
  }

  addAccount() {
    if (!this.newAccount.tipo) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.walletService
      .addAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.newAccount
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeModal();
        },
        error: (err) => {
          console.error('Error al agregar cuenta:', err);
        },
      });
  }

  // ======================
  // Modal: Agregar Valor en Cuenta
  // ======================
  openAddModal(id: string) {
    this.selectedAccountId = id;
    this.isAddValueModalOpen = true;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  applyValue(action: 'add' | 'subtract') {
    if (!this.selectedAccountId) return;

    const account = this.wallet.find((a) => a.id === this.selectedAccountId);
    if (!account) return;

    const finalValue = action === 'subtract' ? -Math.abs(this.newValue) : Math.abs(this.newValue);

    this.walletService
      .registrarMovimiento(
        this.userId,
        this.currentYear,
        this.currentMonth,
        account.id,
        account,
        finalValue,
        'ajuste_manual',
        action === 'subtract' ? 'Ajuste manual (resta)' : 'Ajuste manual (suma)'
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar cuenta:', err);
        },
      });
  }

  // ======================
  // Modal: Editar Cuenta
  // ======================
  openEditModal(id: string) {
    const original = this.wallet.find((a) => a.id === id);
    if (!original) return;

    this.editedAccount = new WalletAccount(original.tipo, original.valor, original.fijo);
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedAccount = new WalletAccount('', 0);
    this.editedId = null;
  }

  saveEditedAccount() {
    if (!this.editedId) return;

    const original = this.wallet.find((a) => a.id === this.editedId);
    const delta = this.editedAccount.valor - (original?.valor ?? this.editedAccount.valor);
    // Usa el tipo YA editado (por si también renombró la cuenta) junto al valor viejo,
    // así registrarMovimiento calcula el nuevo saldo sin perder el rename.
    const walletParaDelta = original
      ? { tipo: this.editedAccount.tipo, valor: original.valor, fijo: original.fijo }
      : null;

    const request$ = delta !== 0 && walletParaDelta
      ? this.walletService.registrarMovimiento(
          this.userId, this.currentYear, this.currentMonth, this.editedId,
          walletParaDelta, delta, 'ajuste_manual', 'Edición manual de saldo'
        )
      : this.walletService.updateAccount(
          this.userId, this.currentYear, this.currentMonth, this.editedId, this.editedAccount
        );

    request$.subscribe({
      next: () => {
        this.loadAllData();
        this.closeEditModal();
      },
      error: (err) => {
        console.error('Error al actualizar cuenta:', err);
      },
    });
  }

  // Metodo para editar valor en modal edicion
  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    this.editedAccount.valor = value;
    input.value = this.formatCurrency(value);
  }

  // ======================
  // Modal: Vaciar Cuenta
  // ======================

  openEmptyModal(id: string) {
    this.isEmptyModalOpen = true;
    this.accountToEmptyId = id;
  }

  closeEmptyModal() {
    this.isEmptyModalOpen = false;
    this.accountToEmptyId = null;
  }

  confirmEmptyAccount() {
    if (!this.accountToEmptyId) return;

    // Buscar la cuenta en el wallet
    const account = this.wallet.find((a) => a.id === this.accountToEmptyId);
    if (!account) return;

    // Actualizar mediante el servicio
    this.walletService
      .registrarMovimiento(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.accountToEmptyId,
        account,
        -account.valor,
        'ajuste_manual',
        'Vaciar billetera'
      )
      .subscribe({
        next: () => {
          this.loadAllData(); // recarga los datos
          this.closeEmptyModal(); // cierra el modal
        },
        error: (err: any) => {
          console.error('Error al vaciar cuenta:', err);
        },
      });
  }

  // ======================
  // Modal: Eliminar Cuenta
  // ======================
  openDeleteModal(id: string) {
    const account = this.wallet.find((a) => a.id === id);
    if (account?.fijo) return; // El Monedero por defecto no se puede eliminar

    this.isDeleteModalOpen = true;
    this.accountToDeleteId = id;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.accountToDeleteId = null;
  }

  confirmDeleteAccount() {
    if (!this.accountToDeleteId) return;

    this.walletService
      .deleteAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.accountToDeleteId
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error al eliminar cuenta:', err);
        },
      });
  }

  // ======================
  // Modal: Transaccion
  // ======================
  openTransactionModal(accountId: string) {
    this.sourceWalletId = accountId;
    this.sourceWallet = this.wallet.find((a) => a.id === accountId);
    this.selectedWallet = '';
    this.assignedValue = null;
    this.transferMode = 'all';
    this.isTransactionModalOpen = true;
  }

  closeTransactionModal() {
    this.isTransactionModalOpen = false;
  }

  confirmTransaction() {
    if (!this.selectedWallet) {
      alert('Selecciona la cuenta destino.');
      return;
    }

    const destination = this.wallet.find((a) => a.id === this.selectedWallet);
    const source = this.sourceWallet;

    if (!source || !destination) return;

    // "Todo el valor" mueve el saldo completo de la cuenta origen; "Otro valor" usa lo que se tipeó.
    const amount = this.transferMode === 'all' ? source.valor : this.assignedValue;

    if (!amount || amount <= 0) {
      alert('Ingresa un valor válido.');
      return;
    }
    if (amount > source.valor) {
      alert('El valor supera el saldo disponible de la cuenta origen.');
      return;
    }

    this.walletService
      .registrarMovimiento(
        this.userId, this.currentYear, this.currentMonth, source.id,
        source, -amount, 'transferencia', `Transferencia a ${destination.tipo}`,
        undefined, destination.id
      )
      .subscribe();
    this.walletService
      .registrarMovimiento(
        this.userId, this.currentYear, this.currentMonth, destination.id,
        destination, amount, 'transferencia', `Transferencia desde ${source.tipo}`,
        undefined, source.id
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeTransactionModal();
        },
        error: (err) => console.error('Error al transferir dinero:', err),
      });
  }

  // Método para calcular el total de la cartera
  getTotalWallet(): number {
    return this.wallet.reduce((sum, e) => sum + Number(e.valor), 0);
  }

  // Método para aplicar formato a la moneda
  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '0';
  }

  // Método para manejar la entrada de valores y formatear
  onValueInput(event: Event, type: 'new' | 'edit' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;

    if (type === 'new') {
      this.newAccount.valor = value;
    } else if (type === 'edit') {
      this.editedAccount.valor = value;
    } else if (type === 'add') {
      this.newValue = value;
    }

    input.value = this.formatCurrency(value);
  }

  // Metodo para alternar al menu de opciones de cada cuenta
  toggleMenu(account: any) {
    const wasOpen = account.showMenu;
    // Cierra cualquier otro menú abierto
    this.wallet.forEach((a: any) => (a.showMenu = false));
    // Alterna el menú actual
    account.showMenu = !wasOpen;
  }

  // Cierra cualquier menú de acciones abierto si el click fue fuera de él
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.wallet-menu-toggle')) return;
    this.wallet.forEach((a: any) => (a.showMenu = false));
  }

  // Metodo para obtener el delay de la animcacion de cada indice
  getAnimationDelay(account: any) {
    const index = this.wallet.indexOf(account);
    return `${0.3 + index * 0.1}s`; // empieza 0.3s, aumenta 0.1s por tarjeta
  }

  // Metodo para manejar la entrada de valores en modal de transaccion
  onAssignedValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/,/g, ''); // quitamos comas
    const value = Number(raw) || 0;

    this.assignedValue = value; // ASIGNAMOS CORRECTAMENTE
    input.value = this.formatCurrency(value); // opcional: mostrar con coma
  }

  // ======================
  // Modal: Historial de Movimientos
  // ======================
  openMovementsModal(accountId: string) {
    const account = this.wallet.find((a) => a.id === accountId);
    this.movementsWalletLabel = account?.tipo ?? '';
    this.isMovementsModalOpen = true;
    this.isLoadingMovimientos = true;
    this.movimientos = [];

    this.walletService
      .getMovimientos(this.userId, this.currentYear, this.currentMonth, accountId)
      .subscribe({
        next: (data) => {
          this.movimientos = data;
          this.isLoadingMovimientos = false;
        },
        error: () => {
          this.isLoadingMovimientos = false;
        },
      });
  }

  closeMovementsModal() {
    this.isMovementsModalOpen = false;
    this.movimientos = [];
  }

  // Agrupa los movimientos por fecha (Hoy / Ayer / fecha completa) para el modal de historial
  getMovementGroups(): { label: string; items: WalletMovementWithId[] }[] {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const groups = new Map<string, WalletMovementWithId[]>();

    for (const mov of this.movimientos) {
      const fecha = new Date(mov.fecha);
      const fechaSinHora = new Date(fecha);
      fechaSinHora.setHours(0, 0, 0, 0);

      let label: string;
      if (fechaSinHora.getTime() === hoy.getTime()) {
        label = 'Hoy';
      } else if (fechaSinHora.getTime() === ayer.getTime()) {
        label = 'Ayer';
      } else {
        label = fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
      }

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(mov);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }

  formatMovementTime(fecha: number): string {
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
