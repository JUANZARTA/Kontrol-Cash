import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { CategoriaGasto, Expense } from '../../models/expense.model';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';
import { WalletService } from '../../services/wallet.service';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

export interface ExpenseWithId extends Expense {
  id: string;
}

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './expense.component.html',
  styleUrls: ['./expense.component.css'],
  providers: [DecimalPipe],
  animations: [
    trigger('accordion', [
      state('closed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
      state('open', style({ height: '*', opacity: 1 })),
      transition('closed <=> open', [animate('300ms ease')]),
    ]),
  ],
})
export default class ExpenseComponent implements OnInit, OnDestroy {
  private expenseService = inject(ExpenseService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService); // ✅ Nuevo
  private authService = inject(AuthService); // ✅ nuevo
  private finanzasService = inject(FinanzasService);
  private walletService = inject(WalletService);

  // Propiedades
  incomes: any[] = [];
  expenses: ExpenseWithId[] = [];
  wallet: any[] = [];
  loans: any[] = [];

  lastAction: 'add' | 'subtract' | null = null;
  currentAction: 'add' | 'subtract' | null = null;

  // Estado financiero
  estadoFinanciero = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Variables nuevas en el componente
  showingToast: boolean = false;
  toastMessage: string = '';
  toastTimeout: any;

  // Selección de billetera para nuevo gasto
  selectedWalletExpense: string = '';

  // Selección de billetera para modal de agregar valor
  selectedWallet: string = '';

  // Monto a asignar de la billetera al gasto
  assignedWalletValue: number = 0;

  // Modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Variables para modales nuevos
  isAddValueModalOpen: boolean = false;
  isDeleteModalOpen: boolean = false;
  selectedExpenseId: string | null = null;
  expenseToDeleteId: string | null = null;
  newValue: number = 0;

  categorias: string[] = Object.values(CategoriaGasto);

  // Gasto nuevo (modal)
  newExpense: Expense = new Expense(
    '',
    CategoriaGasto.Variable,
    null as any,
    null as any
  );

  // Gasto en edición (modal)
  editedExpense: Expense = new Expense(
    '',
    CategoriaGasto.Variable,
    null as any,
    null as any
  );

  editedId: string | null = null;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';

  private dateSubscription: Subscription | undefined; // ✅ Nuevo

  get sortedExpenses() {
    return [...this.expenses].sort((a, b) =>
      a.categoria.localeCompare(b.categoria)
    );
  }

  // Variables para el gráfico
  ngOnInit() {
    // ✅ Suscripción reactiva al cambio de año/mes
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadExpenses();
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

  // Método para cargar los gastos
  loadExpenses() {
    this.expenseService
      .getExpenses(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.expenses = Object.entries(data).map(([id, exp]) => ({
            id,
            ...exp,
          }));
        },
        error: (err) => {
          console.error('❌ Error al cargar gastos:', err);
        },
      });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  // Método para cargar las billeteras
  loadWallets() {
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.wallet = Object.entries(data || {}).map(
            ([id, w]: [string, any]) => ({
              id,
              tipo: w.tipo || 'Sin tipo',
              valor: w.valor || 0,
            })
          );
        },
        error: (err) => {
          console.error('Error al cargar billeteras:', err);
        },
      });
  }
  setAction(action: 'add' | 'subtract'): void {
    this.currentAction = action;
    this.applyValue(action);
  }

  // ======================
  // Modal: Agregar Gasto
  // ======================
  openModal() {
    this.isModalOpen = true;
    this.loadWallets(); // cargar billeteras al abrir modal
    this.selectedWalletExpense = ''; // limpiar selección previa
    this.assignedWalletValue = 0; // resetear valor asignado
    this.newExpense = new Expense('', CategoriaGasto.Variable, 0, 0); // limpiar campos
    this.toastMessage = ''; // limpiar toast
    this.showingToast = false; // resetear toast
  }

  closeModal() {
    this.isModalOpen = false;
    this.newExpense = new Expense('', CategoriaGasto.Variable, 0, 0);
  }

  addExpense() {
    if (!this.newExpense.descripcion || !this.newExpense.categoria) {
      this.showToast('Por favor completa todos los campos.');
      return;
    }

    // Solo pedir billetera si el valor > 0
    if (this.newExpense.valor > 0 && !this.selectedWalletExpense) {
      this.showToast('Selecciona una billetera para descontar el gasto.');
      return;
    }

    const expenseToAdd = {
      ...this.newExpense,
      valor: this.newExpense.valor ?? 0,
      estimacion: this.newExpense.estimacion ?? 0,
    };

    // Guardar gasto
    this.expenseService
      .addExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        expenseToAdd
      )
      .subscribe({
        next: () => {
          // Descontar de la billetera solo si hay valor > 0
          if (this.newExpense.valor > 0) {
            const wallet = this.wallet.find(
              (w) => w.id === this.selectedWalletExpense
            );
            if (wallet) {
              wallet.valor -= this.assignedWalletValue;

              // Guardar cambios de la billetera en DB
              this.walletService
                .updateAccount(
                  this.userId,
                  this.currentYear,
                  this.currentMonth,
                  wallet.id,
                  { tipo: wallet.tipo, valor: wallet.valor }
                )
                .subscribe({
                  next: () => {
                    this.showToast(
                      'Gasto agregado y descontado de la billetera'
                    );
                    this.loadExpenses();
                    this.loadWallets(); // recargar billeteras
                    this.closeModal();
                  },
                  error: (err) =>
                    console.error('Error al actualizar billetera:', err),
                });
            } else {
              this.loadExpenses();
              this.closeModal();
            }
          } else {
            this.loadExpenses();
            this.closeModal();
          }
        },
        error: (err) => console.error('Error al agregar gasto:', err),
      });
  }

  // Método para mostrar "alerta bonita"
  showToast(message: string, duration: number = 3000): void {
    this.toastMessage = message;
    this.showingToast = true;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.toastTimeout = setTimeout(() => {
      this.showingToast = false;
      this.toastMessage = '';
    }, duration);
  }

  // ======================
  // Modal: Agregar Valor en Gasto
  // ======================
  openAddModal(id: string): void {
    this.selectedExpenseId = id;
    this.isAddValueModalOpen = true;

    // Cargar billeteras al abrir el modal
    this.loadWallets();

    // Reiniciar valores
    this.selectedWallet = '';
    this.newValue = 0;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  applyValue(action: 'add' | 'subtract'): void {
    this.lastAction = action;
    if (!this.selectedExpenseId) return;

    if (!this.selectedWallet) {
      this.showToast('Selecciona una billetera para aplicar el valor');
      return;
    }

    const expense = this.expenses.find((e) => e.id === this.selectedExpenseId);
    const wallet = this.wallet.find((w) => w.id === this.selectedWallet);

    if (!expense || !wallet) return;

    const currentExpenseValue = expense.valor;
    const walletBalance = wallet.valor;
    let valueToApply = Math.abs(this.newValue);

    // 🔹 VALIDACIONES PRINCIPALES
    if (action === 'add') {
      // No permitir sumar más de lo que hay en la billetera
      if (valueToApply > walletBalance) {
        this.showToast(
          'No puedes sumar más que el saldo disponible en la billetera'
        );
        return;
      }
      // Aplicar suma
      wallet.valor -= valueToApply;
      expense.valor += valueToApply;
    } else if (action === 'subtract') {
      // No permitir restar más que el valor actual del gasto
      if (valueToApply > currentExpenseValue) {
        this.showToast('No puedes restar más que el valor actual del gasto');
        return;
      }
      // Aplicar resta (devuelve dinero a la billetera)
      wallet.valor += valueToApply;
      expense.valor -= valueToApply;
    }

    // 🔹 Actualizar billetera y gasto en la base de datos
    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        wallet.id,
        { tipo: wallet.tipo, valor: wallet.valor }
      )
      .subscribe({
        next: () => {
          this.expenseService
            .updateExpense(
              this.userId,
              this.currentYear,
              this.currentMonth,
              expense.id,
              {
                descripcion: expense.descripcion,
                categoria: expense.categoria,
                valor: expense.valor,
                estimacion: expense.estimacion,
              }
            )
            .subscribe({
              next: () => {
                this.showToast('Operación aplicada correctamente');
                this.loadExpenses();
                this.loadWallets();
                this.closeAddValueModal();
              },
              error: (err) => console.error('Error al actualizar gasto:', err),
            });
        },
        error: (err) => console.error('Error al actualizar billetera:', err),
      });
  }

  // ======================
  // Modal: Editar Gasto
  // ======================
  openEditModal(id: string) {
    const original = this.expenses.find((e) => e.id === id);
    if (!original) return;

    this.editedExpense = new Expense(
      original.descripcion,
      original.categoria,
      original.valor,
      original.estimacion
    );
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedExpense = new Expense('', CategoriaGasto.Variable, 0, 0);
    this.editedId = null;
  }

  saveEditedExpense() {
    if (!this.editedId) return;

    this.expenseService
      .updateExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        this.editedExpense
      )
      .subscribe({
        next: () => {
          this.loadExpenses();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al editar gasto:', err);
        },
      });
  }

  // ======================
  // Modal: Eliminar Gasto
  // ======================
  openDeleteModal(id: string) {
    this.isDeleteModalOpen = true;
    this.expenseToDeleteId = id;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.expenseToDeleteId = null;
  }

  confirmDeleteExpense() {
    if (!this.expenseToDeleteId) return;

    this.expenseService
      .deleteExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.expenseToDeleteId
      )
      .subscribe({
        next: () => {
          this.loadExpenses();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error al eliminar gasto:', err);
        },
      });
  }

  // Método para eliminar todos los gastos
  getTotalExpenses(): number {
    return this.expenses.reduce((sum, e) => sum + Number(e.valor), 0);
  }

  // Método para obtener el total estimado de gastos
  getTotalEstimated(): number {
    return this.expenses.reduce((sum, e) => sum + Number(e.estimacion), 0);
  }

  // Formatear un número a moneda (1,000)
  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  // Verifica si un gasto está sobre la estimación
  isOverBudget(expense: ExpenseWithId): boolean {
    return Number(expense.valor) > Number(expense.estimacion);
  }

  // Método para calcular el total de un grupo de gastos
  getGroupTotal(items: ExpenseWithId[]): number {
    return items.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }

  // Método para calcular el total estimado de un grupo de gastos
  getGroupEstimatedTotal(items: ExpenseWithId[]): number {
    return items.reduce((acc, item) => acc + (Number(item.estimacion) || 0), 0);
  }

  // Método para obtener el total estimado de gastos
  getTotalEstimations(): number {
    return this.expenses.reduce((sum, e) => sum + Number(e.estimacion), 0);
  }

  // Procesar entrada y convertir a número limpio
  onValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d]/g, '');
    const numericValue = Number(rawValue) || 0;

    // ✅ Permitir escribir cualquier número libremente
    this.newValue = numericValue;

    // ✅ Solo formateamos la vista
    input.value = this.formatCurrency(numericValue);
  }

  // Manejar input en modal de edición
  onEditValueInput(event: Event, field: 'valor' | 'estimacion'): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d-]/g, '');
    const numericValue = Number(rawValue) || 0;

    this.editedExpense[field] = numericValue;
    input.value = this.formatCurrency(numericValue);
  }

  getGroupedExpenses() {
    const groups: { [categoria: string]: ExpenseWithId[] } = {};

    this.expenses.forEach((expense) => {
      if (!groups[expense.categoria]) groups[expense.categoria] = [];
      groups[expense.categoria].push(expense);
    });

    return Object.keys(groups).map((categoria, index) => ({
      categoria,
      items: groups[categoria],
      open: true, // abrir acordeón por defecto
      groupIndex: index, // opcional para animaciones
    }));
  }

  getExpenseRowDelay(index: number, groupIndex: number): string {
    // Cada grupo tiene delay base + fila incremental
    return `${0.1 + groupIndex * 0.05 + index * 0.03}s`;
  }

  // Maneja el input de valor en el modal de nuevo gasto
  onExpenseValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d]/g, '');
    let numericValue = Number(rawValue) || 0;

    // Limitar al saldo de la billetera seleccionada
    if (this.selectedWalletExpense) {
      const wallet = this.wallet.find(
        (w) => w.id === this.selectedWalletExpense
      );
      if (wallet && numericValue > wallet.valor) {
        numericValue = wallet.valor;
        this.showToast('No puedes gastar más que el saldo de la billetera');
      }
    }

    this.newExpense.valor = numericValue;
    input.value = this.formatCurrency(numericValue);

    // Ajustar assignedWalletValue al valor del input
    this.assignedWalletValue = numericValue;
  }

  // ----------------------------
  // Método para obtener saldo de una billetera
  // ----------------------------
  getWalletBalance(walletId: string): string {
    const w = this.wallet.find((wallet) => wallet.id === walletId);
    return w ? this.formatCurrency(w.valor) : '0';
  }

  onNewExpenseValueInput(event: Event, field: 'valor' | 'estimacion'): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d]/g, '');
    let numericValue = Number(rawValue) || 0;

    // Si está editando el valor del gasto, limitar al saldo de la billetera seleccionada
    if (field === 'valor' && this.selectedWalletExpense) {
      const wallet = this.wallet.find(
        (w) => w.id === this.selectedWalletExpense
      );
      if (wallet && numericValue > wallet.valor) {
        numericValue = wallet.valor;
        this.showToast('No puedes gastar más que el saldo de la billetera');
      }
    }

    // Asignar valor
    if (field === 'valor') this.newExpense.valor = numericValue;
    else this.newExpense.estimacion = numericValue;

    input.value = this.formatCurrency(numericValue);
  }
}
