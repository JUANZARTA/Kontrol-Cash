import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { WalletAccount } from '../../models/wallet.model';
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

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu: boolean;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
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
  selectedAccountId: string | null = null;
  accountToDeleteId: string | null = null;
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

  // Modal de transaccion
  isTransactionModalOpen = false;
  selectedWallet = '';
  assignedValue: number | null = null;
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

  // Método para revisar si el total es bajo y notificar
  checkLowFunds() {
    const total = this.getTotalWallet();
    if (total < 100000) {
      this.authService
        .addNotification(this.userId, 'Tu efectivo bajó a menos de $100.000')
        .subscribe();
    }
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

    let finalValue = this.newValue;

    if (action === 'subtract') {
      finalValue = -Math.abs(this.newValue);
    } else {
      finalValue = Math.abs(this.newValue);
    }

    const updatedValue = account.valor + finalValue;

    const updatedAccount: WalletAccount = {
      tipo: account.tipo,
      valor: updatedValue,
    };

    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        account.id,
        updatedAccount
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

    this.editedAccount = new WalletAccount(original.tipo, original.valor);
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

    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        this.editedAccount
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al actualizar cuenta:', err);
        },
      });
  }

  // ======================
  // Modal: Eliminar Cuenta
  // ======================
  openDeleteModal(id: string) {
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
    if (!this.assignedValue || this.assignedValue <= 0) {
      alert('Ingresa un valor válido.');
      return;
    }

    const destination = this.wallet.find((a) => a.id === this.selectedWallet);
    const source = this.sourceWallet;

    if (!source || !destination) return;

    if (this.assignedValue > source.valor) {
      alert('El valor supera el saldo disponible de la cuenta origen.');
      return;
    }

    // Actualizar valores localmente
    source.valor -= this.assignedValue;
    destination.valor += this.assignedValue;

    // Actualizar en backend
    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        source.id,
        { tipo: source.tipo, valor: source.valor }
      )
      .subscribe();
    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        destination.id,
        { tipo: destination.tipo, valor: destination.valor }
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

  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    this.editedAccount.valor = value;
    input.value = this.formatCurrency(value);
  }

  toggleMenu(account: any) {
    // Cierra cualquier otro menú abierto
    this.wallet.forEach((a: any) => (a.showMenu = false));
    // Alterna el menú actual
    account.showMenu = !account.showMenu;
  }

  getAnimationDelay(account: any) {
    const index = this.wallet.indexOf(account);
    return `${0.3 + index * 0.1}s`; // empieza 0.3s, aumenta 0.1s por tarjeta
  }

  onAssignedValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/,/g, ''); // quitamos comas
    const value = Number(raw) || 0;

    this.assignedValue = value; // ASIGNAMOS CORRECTAMENTE
    input.value = this.formatCurrency(value); // opcional: mostrar con coma
  }
}
