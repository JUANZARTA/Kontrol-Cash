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
  imports: [CommonModule, FormsModule, MatIconModule],
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

  // Propiedades
  incomes: any[] = [];
  expenses: ExpenseWithId[] = [];
  wallet: any[] = [];
  loans: any[] = [];

  // Estado financiero
  estadoFinanciero = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

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

  // ======================
  // Modal: Agregar Gasto
  // ======================
  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.newExpense = new Expense('', CategoriaGasto.Variable, 0, 0);
  }

  addExpense() {
    if (!this.newExpense.descripcion || !this.newExpense.categoria) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.expenseService
      .addExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.newExpense
      )
      .subscribe({
        next: () => {
          this.loadExpenses();
          this.closeModal();
        },
        error: (err) => {
          console.error('Error al agregar gasto:', err);
        },
      });
  }

  // ======================
  // Modal: Agregar Valor en Gasto
  // ======================
  openAddModal(id: string) {
    this.selectedExpenseId = id;
    this.isAddValueModalOpen = true;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  applyValue(action: 'add' | 'subtract') {
    if (!this.selectedExpenseId) return;

    const expense = this.expenses.find((e) => e.id === this.selectedExpenseId);
    if (!expense) return;

    let finalValue = this.newValue;

    if (action === 'subtract') {
      finalValue = -Math.abs(this.newValue); // asegurar negativo
    } else {
      finalValue = Math.abs(this.newValue); // asegurar positivo
    }

    const updatedValue = expense.valor + finalValue;

    const updatedExpense: Expense = {
      descripcion: expense.descripcion,
      categoria: expense.categoria,
      valor: updatedValue,
      estimacion: expense.estimacion,
    };

    this.expenseService
      .updateExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        expense.id,
        updatedExpense
      )
      .subscribe({
        next: () => {
          this.loadExpenses();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar gasto:', err);
        },
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

  // Método para formatear el valor a moneda
  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  // Método para formatear el valor a porcentaje
  isOverBudget(expense: Expense): boolean {
    return Number(expense.valor) > Number(expense.estimacion);
  }

  // Método para calcular el total por categoría
  getGroupTotal(items: any[]) {
    return items.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }

  // Método para calcular el total estimado por categoría
  getGroupEstimatedTotal(items: any[]) {
    return items.reduce((acc, item) => acc + (Number(item.estimacion) || 0), 0);
  }

  // Método para calcular el total de estimaciones
  getTotalEstimations() {
    return this.expenses.reduce(
      (acc, item) => acc + (Number(item.estimacion) || 0),
      0
    );
  }

  // Procesar entrada y convertir a número limpio
  onValueInput(event: Event, field: 'valor' | 'estimacion' | 'add') {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d-]/g, '');
    const numericValue = Number(rawValue) || 0;

    if (field === 'valor') {
      this.newExpense.valor = numericValue;
    } else if (field === 'estimacion') {
      this.newExpense.estimacion = numericValue;
    } else if (field === 'add') {
      this.newValue = numericValue;
    }

    input.value = this.formatCurrency(numericValue);
  }

  onEditValueInput(event: Event, field: 'valor' | 'estimacion') {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[.,]/g, '');
    const numericValue = Number(rawValue) || 0;
    this.editedExpense[field] = numericValue;
    input.value = this.formatCurrency(numericValue);
  }

  getGroupedExpenses() {
    const groups: { [categoria: string]: any[] } = {};

    // Agrupar los gastos por categoría
    this.expenses.forEach((expense) => {
      if (!groups[expense.categoria]) {
        groups[expense.categoria] = [];
      }
      groups[expense.categoria].push(expense);
    });

    // Convertir a array de objetos con open = true
    return Object.keys(groups).map((categoria) => ({
      categoria,
      items: groups[categoria],
      open: true, // abre cada acordeón por defecto
    }));
  }

  getExpenseRowDelay(index: number, groupIndex: number): string {
    // Cada grupo tiene delay base + fila incremental
    return `${0.1 + groupIndex * 0.05 + index * 0.03}s`;
  }
}
