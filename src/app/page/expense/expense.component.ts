import { Component, OnInit, inject, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExpenseService } from '../../services/expense.service';
import { CategoriaGasto, Expense } from '../../models/expense.model';
import { SubExpenseService } from '../../services/sub-expense.service';
import { SubExpense, SubExpenseWithId } from '../../models/sub-expense.model';
import { DateService } from '../../services/date.service';
import { Subscription, of, forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';
import { WalletService } from '../../services/wallet.service';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { PlannerService } from '../../services/planner.service';
import { AttachmentsService } from '../../services/attachments.service';
import { MovementAttachment } from '../../models/attachment.model';
import { ScanReceiptService, ScannedItem } from '../../services/scan-receipt.service';

import { LongPressDirective } from '../../shared/directives/long-press.directive';

import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

export interface ExpenseWithId extends Expense {
  id: string;
  // Viene embebido "gratis" en la respuesta de getExpenses() cuando el gasto tiene
  // subgastos (Firebase devuelve el subárbol completo bajo gastos/{id}), no hace falta
  // un fetch aparte para saber si una fila tiene subgastos.
  subgastos?: Record<string, SubExpense>;
}

@Component({
  selector: 'app-expense',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent, LongPressDirective],
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
  private plannerService = inject(PlannerService);
  private attachmentsService = inject(AttachmentsService);
  private scanReceiptService = inject(ScanReceiptService);
  private subExpenseService = inject(SubExpenseService);

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

  // Valor centinela para "Descuadre" en los selects de billetera: no es una billetera real,
  // solo aparece cuando hay un descuadre (cuadreDescuadre < 0) y al elegirlo el gasto se
  // guarda sin tocar ninguna billetera — sirve para reconciliar gasto ya ocurrido sin registrar.
  readonly DESCUADRE = '__descuadre__';

  get hayDescuadre(): boolean {
    return this.cuadreDescuadre < 0;
  }

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
  selectedIds = new Set<string>();
  showBulkDeleteConfirm = false;
  selectionMode = false;
  selectedExpenseId: string | null = null;
  expenseToDeleteId: string | null = null;
  newValue: number = 0;

  defaultCategorias: string[] = Object.values(CategoriaGasto);
  categorias: string[] = [...this.defaultCategorias];
  customCategories: string[] = [];
  customCategoryName = '';
  showCustomCategories = false;
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
  movementAttachments: Record<string, MovementAttachment[]> = {};

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';

  private dateSubscription: Subscription | undefined; // ✅ Nuevo

  private readonly categoryOrder = Object.values(CategoriaGasto);

  // Filtros de la tabla (no afectan Totales Generales, que siempre suma todo el mes)
  filterSearch = '';
  filterCategoria = '';
  filterComparativo: '' | 'over' | 'under' = '';
  showCategoryFilter = false;

  get hasActiveFilters(): boolean {
    return !!this.filterSearch.trim() || !!this.filterCategoria || !!this.filterComparativo;
  }

  toggleCategoryFilter(): void {
    this.showCategoryFilter = !this.showCategoryFilter;
  }

  setFilterCategoria(categoria: string): void {
    this.filterCategoria = categoria;
    this.showCategoryFilter = false;
  }

  clearFilters(): void {
    this.filterSearch = '';
    this.filterCategoria = '';
    this.filterComparativo = '';
  }

  // Cierra el desplegable de categoría al hacer clic afuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.expense-category-filter')) {
      this.showCategoryFilter = false;
    }
  }

  private matchesFilters(expense: ExpenseWithId): boolean {
    if (this.filterCategoria && expense.categoria !== this.filterCategoria) return false;

    const query = this.filterSearch.trim().toLowerCase();
    if (query && !expense.descripcion.toLowerCase().includes(query)) return false;

    if (this.filterComparativo === 'over' && !(Number(expense.valor) > Number(expense.estimacion))) return false;
    if (this.filterComparativo === 'under' && !(Number(expense.valor) <= Number(expense.estimacion))) return false;

    return true;
  }

  get sortedExpenses() {
    return this.expenses
      .filter(e => this.matchesFilters(e))
      .sort((a, b) => {
        const ai = this.categoryOrder.indexOf(a.categoria as CategoriaGasto);
        const bi = this.categoryOrder.indexOf(b.categoria as CategoriaGasto);
        const aIdx = ai === -1 ? this.categoryOrder.length : ai;
        const bIdx = bi === -1 ? this.categoryOrder.length : bi;
        return aIdx - bIdx || a.descripcion.localeCompare(b.descripcion);
      });
  }

  // Variables para el gráfico
  ngOnInit() {
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadPlannerConfig();
        this.loadExpenses();
      }
    });

    inject(ActivatedRoute).queryParamMap.subscribe((params) => {
      if (params.get('action') === 'add') {
        setTimeout(() => this.openModal(), 0);
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
          this.refreshAttachments();
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

  loadPlannerConfig() {
    this.plannerService.getCustomCategories(this.userId, 'expense').subscribe((categories) => {
      this.customCategories = categories;
      this.categorias = [...this.defaultCategorias, ...categories];
      if (!this.categorias.includes(this.newExpense.categoria)) {
        this.newExpense.categoria = this.categorias[0] || CategoriaGasto.Variable;
      }
      if (!this.categorias.includes(this.editedExpense.categoria)) {
        this.editedExpense.categoria = this.categorias[0] || CategoriaGasto.Variable;
      }
    });
  }

  addCustomCategory() {
    const category = this.customCategoryName.trim();
    if (!category) return;

    const normalized = category.toLowerCase();
    const exists = this.categorias.some((item) => item.toLowerCase() === normalized);
    if (exists) {
      this.customCategoryName = '';
      return;
    }

    const updatedCategories = [...this.categorias, category].filter(
      (value) => !this.defaultCategorias.includes(value)
    );

    this.plannerService.saveCustomCategories(this.userId, 'expense', updatedCategories).subscribe(() => {
      this.customCategoryName = '';
      this.loadPlannerConfig();
    });
  }

  removeCustomCategory(category: string) {
    const updatedCategories = this.customCategories.filter((item) => item !== category);
    this.plannerService.saveCustomCategories(this.userId, 'expense', updatedCategories).subscribe(() => {
      this.loadPlannerConfig();
    });
  }

  isCustomCategoryInUse(category: string): boolean {
    return this.expenses.some((item) => item.categoria === category);
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
          const isDescuadre = this.selectedWalletExpense === this.DESCUADRE;

          // Descontar de la billetera solo si hay valor > 0 y no es un descuadre
          if (this.newExpense.valor > 0 && !isDescuadre) {
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
            if (this.newExpense.valor > 0 && isDescuadre) {
              this.showToast('Gasto agregado como descuadre, sin descontar billetera');
            }
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
    if (!expense) return;

    const isDescuadre = this.selectedWallet === this.DESCUADRE;
    const wallet = isDescuadre ? null : this.wallet.find((w) => w.id === this.selectedWallet);

    if (!isDescuadre && !wallet) return;

    const currentExpenseValue = expense.valor;
    const walletBalance = wallet?.valor ?? 0;
    let valueToApply = Math.abs(this.newValue);

    // 🔹 VALIDACIONES PRINCIPALES
    if (action === 'add') {
      // No permitir sumar más de lo que hay en la billetera (no aplica para descuadre)
      if (wallet && valueToApply > walletBalance) {
        this.showToast(
          'No puedes sumar más que el saldo disponible en la billetera'
        );
        return;
      }
      // Aplicar suma
      if (wallet) wallet.valor -= valueToApply;
      expense.valor += valueToApply;
    } else if (action === 'subtract') {
      // No permitir restar más que el valor actual del gasto
      if (valueToApply > currentExpenseValue) {
        this.showToast('No puedes restar más que el valor actual del gasto');
        return;
      }
      // Aplicar resta (devuelve dinero a la billetera, salvo si es descuadre)
      if (wallet) wallet.valor += valueToApply;
      expense.valor -= valueToApply;
    }

    const finishExpenseUpdate = () => {
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
    };

    // 🔹 Actualizar billetera (si aplica) y gasto en la base de datos
    if (wallet) {
      this.walletService
        .updateAccount(
          this.userId,
          this.currentYear,
          this.currentMonth,
          wallet.id,
          { tipo: wallet.tipo, valor: wallet.valor }
        )
        .subscribe({
          next: finishExpenseUpdate,
          error: (err) => console.error('Error al actualizar billetera:', err),
        });
    } else {
      finishExpenseUpdate();
    }
  }

  // ======================
  // Modal: Editar Gasto
  // ======================
  // true cuando el gasto que se está editando tiene subgastos: en ese caso el valor es
  // calculado (suma de los subgastos) y el campo "Valor" del modal de edición se bloquea.
  editedExpenseHasSubExpenses = false;

  openEditModal(id: string) {
    const original = this.expenses.find((e) => e.id === id);
    if (!original) return;

    this.editedExpenseHasSubExpenses = this.hasSubExpenses(original);
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
    this.editedExpenseHasSubExpenses = false;
  }

  saveEditedExpense() {
    if (!this.editedId) return;

    // Si el gasto tiene subgastos, el valor no se toca desde acá: lo maneja
    // syncParentValorFromSubExpenses() cuando se agrega/edita/elimina un subgasto.
    const original = this.expenses.find((e) => e.id === this.editedId);
    const payload: Expense = {
      ...this.editedExpense,
      valor: this.editedExpenseHasSubExpenses ? (original?.valor ?? this.editedExpense.valor) : this.editedExpense.valor,
    };

    this.expenseService
      .updateExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        payload
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
          this.removeAllAttachments(this.expenseToDeleteId as string);
          this.loadExpenses();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error al eliminar gasto:', err);
        },
      });
  }

  private refreshAttachments(): void {
    this.movementAttachments = {};
    this.expenses.forEach((expense) => {
      this.movementAttachments[expense.id] = this.attachmentsService.list(
        this.userId,
        this.currentYear,
        this.currentMonth,
        expense.id
      );
    });
  }

  onUploadAttachment(expenseId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.attachmentsService
      .upload(this.userId, this.currentYear, this.currentMonth, expenseId, file)
      .then(() => this.refreshAttachments());

    input.value = '';
  }

  getAttachments(expenseId: string): MovementAttachment[] {
    return this.movementAttachments[expenseId] || [];
  }

  openAttachment(url: string): void {
    window.open(url, '_blank');
  }

  removeAttachment(expenseId: string, attachmentId: string): void {
    const deleted = this.attachmentsService.delete(
      this.userId,
      this.currentYear,
      this.currentMonth,
      expenseId,
      attachmentId
    );
    if (deleted) this.refreshAttachments();
  }

  private removeAllAttachments(expenseId: string): void {
    this.getAttachments(expenseId).forEach((item) => {
      if (item.id) {
        this.attachmentsService.delete(
          this.userId,
          this.currentYear,
          this.currentMonth,
          expenseId,
          item.id
        );
      }
    });
  }

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

  // Pagar gasto fijo
  showPayFijoModal = false;
  payFijoExpense: ExpenseWithId | null = null;
  selectedWalletForFijo = '';

  openPayFijoModal(id: string): void {
    const expense = this.expenses.find(e => e.id === id);
    if (!expense) return;
    this.payFijoExpense = expense;
    this.selectedWalletForFijo = '';
    this.showPayFijoModal = true;
    this.loadWallets();
  }

  closePayFijoModal(): void {
    this.showPayFijoModal = false;
    this.payFijoExpense = null;
    this.selectedWalletForFijo = '';
  }

  confirmPayFijo(): void {
    if (!this.payFijoExpense || !this.selectedWalletForFijo) return;

    const expense = this.payFijoExpense;
    const account = this.wallet.find(w => w.id === this.selectedWalletForFijo);
    if (!account) return;

    const monto = Number(expense.estimacion);

    if (account.valor < monto) {
      this.showToast('Saldo insuficiente en la billetera seleccionada.');
      return;
    }

    account.valor -= monto;

    this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, account.id, { tipo: account.tipo, valor: account.valor })
      .subscribe({
        next: () => {
          this.expenseService.updateExpense(this.userId, this.currentYear, this.currentMonth, expense.id, {
            descripcion: expense.descripcion,
            categoria: expense.categoria,
            valor: Number(expense.valor) + monto,
            estimacion: expense.estimacion,
          }).subscribe({
            next: () => {
              this.closePayFijoModal();
              this.loadExpenses();
              this.showToast(`$${this.formatCurrency(monto)} descontados de ${account.tipo}.`);
            },
            error: err => console.error('Error al actualizar gasto fijo:', err),
          });
        },
        error: err => console.error('Error al actualizar billetera:', err),
      });
  }

  // Scan receipt
  showScanModal = false;
  scanLoading = false;
  scanError = '';
  scannedItems: ScannedItem[] = [];
  selectedScanItems = new Set<number>();

  openScanModal(): void {
    this.showScanModal = true;
    this.scanLoading = false;
    this.scanError = '';
    this.scannedItems = [];
    this.selectedScanItems.clear();
  }

  closeScanModal(): void {
    this.showScanModal = false;
  }

  onScanFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.scanLoading = true;
    this.scanError = '';
    this.scannedItems = [];
    this.selectedScanItems.clear();

    this.scanReceiptService.scan(file).subscribe({
      next: (items) => {
        this.scannedItems = items;
        items.forEach((_, i) => this.selectedScanItems.add(i));
        this.scanLoading = false;
      },
      error: (err) => {
        console.error('[Scan] error:', err);
        this.scanError = 'No se pudo leer la imagen. Intenta con una foto más clara y bien iluminada.';
        this.scanLoading = false;
      }
    });
  }

  toggleScanItem(index: number): void {
    if (this.selectedScanItems.has(index)) this.selectedScanItems.delete(index);
    else this.selectedScanItems.add(index);
  }

  importScannedItems(): void {
    const ops = Array.from(this.selectedScanItems).map((i) => {
      const item = this.scannedItems[i];
      const expense = new Expense(
        item.nombre,
        CategoriaGasto.Variable,
        0,
        item.precio * item.cantidad
      );
      return this.expenseService.addExpense(this.userId, this.currentYear, this.currentMonth, expense);
    });

    if (ops.length === 0) return;

    forkJoin(ops).subscribe(() => {
      this.closeScanModal();
      this.loadExpenses();
      this.showToast(`${ops.length} gasto(s) importados como estimación.`);
    });
  }

  activateSelection(id: string): void {
    this.selectionMode = true;
    this.selectedIds.add(id);
  }

  exitSelectionMode(): void {
    this.selectionMode = false;
    this.selectedIds.clear();
    this.showBulkDeleteConfirm = false;
  }

  get hasSelection(): boolean { return this.selectedIds.size > 0; }
  get selectionCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.expenses.length > 0 && this.expenses.every(e => this.selectedIds.has(e.id)); }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleSelectAll(): void {
    if (this.allSelected) this.selectedIds.clear();
    else this.expenses.forEach(e => this.selectedIds.add(e.id));
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds);
    const ops = ids.map(id => this.expenseService.deleteExpense(this.userId, this.currentYear, this.currentMonth, id));
    forkJoin(ops).subscribe(() => {
      this.selectedIds.clear();
      this.showBulkDeleteConfirm = false;
      this.loadExpenses();
    });
  }

  // ======================
  // Subgastos (no aplica a Fijo)
  // ======================
  hasSubExpenses(expense: ExpenseWithId): boolean {
    return !!expense.subgastos && Object.keys(expense.subgastos).length > 0;
  }

  showSubExpensesModal = false;
  subExpensesParent: ExpenseWithId | null = null;
  subExpenses: SubExpenseWithId[] = [];
  subExpenseLoading = false;

  newSubExpense: { nombre: string; valor: number; walletId: string } = { nombre: '', valor: 0, walletId: '' };
  editingSubExpenseId: string | null = null;
  editSubExpenseDraft: { nombre: string; valor: number } = { nombre: '', valor: 0 };

  get subExpensesTotal(): number {
    return this.subExpenses.reduce((sum, s) => sum + Number(s.valor), 0);
  }

  openSubExpensesModal(id: string): void {
    const expense = this.expenses.find((e) => e.id === id);
    if (!expense) return;

    this.subExpensesParent = expense;
    this.showSubExpensesModal = true;
    this.newSubExpense = { nombre: '', valor: 0, walletId: '' };
    this.editingSubExpenseId = null;
    this.loadWallets();
    this.loadSubExpenses();
  }

  closeSubExpensesModal(): void {
    this.showSubExpensesModal = false;
    this.subExpensesParent = null;
    this.subExpenses = [];
    this.editingSubExpenseId = null;
  }

  private loadSubExpenses(onLoaded?: () => void): void {
    if (!this.subExpensesParent) return;
    const parentId = this.subExpensesParent.id;

    this.subExpenseLoading = true;
    this.subExpenseService
      .getSubExpenses(this.userId, this.currentYear, this.currentMonth, parentId)
      .subscribe((data) => {
        this.subExpenses = Object.entries(data || {}).map(([id, s]) => ({ id, ...(s as SubExpense) }));
        this.subExpenseLoading = false;

        // Primera vez que se abren subgastos en una fila que ya tenía valor cargado a mano:
        // se crea un renglón "saldo inicial" con ese valor para no perderlo. A partir de acá
        // el valor del gasto padre pasa a ser siempre la suma de sus subgastos.
        if (this.subExpenses.length === 0 && Number(this.subExpensesParent?.valor) > 0) {
          const seed = new SubExpense(`${this.subExpensesParent!.descripcion} (saldo inicial)`, Number(this.subExpensesParent!.valor));
          this.subExpenseService
            .addSubExpense(this.userId, this.currentYear, this.currentMonth, parentId, seed)
            .subscribe(() => this.loadSubExpenses(onLoaded));
          return;
        }

        onLoaded?.();
      });
  }

  // Recalcula el valor del gasto padre como la suma de sus subgastos y lo persiste
  // (PATCH, no pisa el nodo "subgastos"). Se llama después de cada add/editar/eliminar.
  private syncParentValorFromSubExpenses(): void {
    if (!this.subExpensesParent) return;
    const parent = this.subExpensesParent;
    const total = this.subExpensesTotal;

    this.expenseService
      .updateExpense(this.userId, this.currentYear, this.currentMonth, parent.id, {
        descripcion: parent.descripcion,
        categoria: parent.categoria,
        valor: total,
        estimacion: parent.estimacion,
      })
      .subscribe(() => {
        parent.valor = total;
        this.loadExpenses();
      });
  }

  onNewSubExpenseValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d]/g, '');
    const numericValue = Number(rawValue) || 0;
    this.newSubExpense.valor = numericValue;
    input.value = this.formatCurrency(numericValue);
  }

  onEditSubExpenseValueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.replace(/[^\d]/g, '');
    const numericValue = Number(rawValue) || 0;
    this.editSubExpenseDraft.valor = numericValue;
    input.value = this.formatCurrency(numericValue);
  }

  addSubExpense(): void {
    if (!this.subExpensesParent) return;

    const nombre = this.newSubExpense.nombre.trim();
    const valor = Number(this.newSubExpense.valor);
    if (!nombre || valor <= 0) {
      this.showToast('Completa nombre y valor del subgasto.');
      return;
    }
    if (!this.newSubExpense.walletId) {
      this.showToast('Selecciona una billetera para el subgasto.');
      return;
    }

    const isDescuadre = this.newSubExpense.walletId === this.DESCUADRE;
    const wallet = isDescuadre ? null : this.wallet.find((w) => w.id === this.newSubExpense.walletId);
    if (!isDescuadre && !wallet) return;

    if (wallet && valor > wallet.valor) {
      this.showToast('No puedes gastar más que el saldo de la billetera.');
      return;
    }

    const parentId = this.subExpensesParent.id;
    const sub = new SubExpense(nombre, valor, isDescuadre ? undefined : wallet!.id);

    const afterWallet = () => {
      this.subExpenseService
        .addSubExpense(this.userId, this.currentYear, this.currentMonth, parentId, sub)
        .subscribe(() => {
          this.newSubExpense = { nombre: '', valor: 0, walletId: '' };
          this.loadWallets();
          this.loadSubExpenses(() => this.syncParentValorFromSubExpenses());
        });
    };

    if (wallet) {
      wallet.valor -= valor;
      this.walletService
        .updateAccount(this.userId, this.currentYear, this.currentMonth, wallet.id, { tipo: wallet.tipo, valor: wallet.valor })
        .subscribe(afterWallet);
    } else {
      afterWallet();
    }
  }

  startEditSubExpense(sub: SubExpenseWithId): void {
    this.editingSubExpenseId = sub.id;
    this.editSubExpenseDraft = { nombre: sub.nombre, valor: sub.valor };
  }

  cancelEditSubExpense(): void {
    this.editingSubExpenseId = null;
  }

  saveEditedSubExpense(): void {
    if (!this.subExpensesParent || !this.editingSubExpenseId) return;
    const original = this.subExpenses.find((s) => s.id === this.editingSubExpenseId);
    if (!original) return;

    const nombre = this.editSubExpenseDraft.nombre.trim();
    const valor = Number(this.editSubExpenseDraft.valor);
    if (!nombre || valor <= 0) {
      this.showToast('Completa nombre y valor del subgasto.');
      return;
    }

    const parentId = this.subExpensesParent.id;
    const delta = valor - Number(original.valor);
    const wallet = original.walletId && original.walletId !== this.DESCUADRE
      ? this.wallet.find((w) => w.id === original.walletId)
      : null;

    if (wallet && delta > 0 && delta > wallet.valor) {
      this.showToast('No puedes gastar más que el saldo de la billetera.');
      return;
    }

    const applyWalletDelta = () => {
      if (!wallet || delta === 0) return of(null);
      wallet.valor -= delta;
      return this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, wallet.id, { tipo: wallet.tipo, valor: wallet.valor });
    };

    applyWalletDelta().subscribe(() => {
      const updated = new SubExpense(nombre, valor, original.walletId);
      this.subExpenseService
        .updateSubExpense(this.userId, this.currentYear, this.currentMonth, parentId, original.id, updated)
        .subscribe(() => {
          this.editingSubExpenseId = null;
          this.loadWallets();
          this.loadSubExpenses(() => this.syncParentValorFromSubExpenses());
        });
    });
  }

  deleteSubExpense(sub: SubExpenseWithId): void {
    if (!this.subExpensesParent) return;
    const parentId = this.subExpensesParent.id;

    const refund = () => {
      if (!sub.walletId || sub.walletId === this.DESCUADRE) return of(null);
      const wallet = this.wallet.find((w) => w.id === sub.walletId);
      if (!wallet) return of(null);
      wallet.valor += Number(sub.valor);
      return this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, wallet.id, { tipo: wallet.tipo, valor: wallet.valor });
    };

    refund().subscribe(() => {
      this.subExpenseService
        .deleteSubExpense(this.userId, this.currentYear, this.currentMonth, parentId, sub.id)
        .subscribe(() => {
          this.loadWallets();
          this.loadSubExpenses(() => this.syncParentValorFromSubExpenses());
        });
    });
  }
}
