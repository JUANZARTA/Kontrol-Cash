import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncomeService } from '../../services/income.service';
import { CategoriaIngreso, Income } from '../../models/income.model';
import { DateService } from '../../services/date.service'; // ✅ Nuevo
import { Subscription } from 'rxjs'; // ✅ Nuevo
import { AuthService } from '../../services/auth.service'; // ✅ Nuevo
import { FinanzasService } from '../../services/finanzas.service';
import { DebtService } from '../../services/debts.service';
import { Debt } from '../../models/debt.model';
import { MatIconModule } from '@angular/material/icon';
import { WalletAccount } from '../../models/wallet.model';
import { WalletService } from '../../services/wallet.service';
import { LoanService } from '../../services/loans.service';
import { ExpenseService } from '../../services/expense.service';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { PlannerService } from '../../services/planner.service';
import { RecurrentItem } from '../../models/planner.model';

// Extiende WalletAccount para agregar id y showMenu
export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu: boolean;
}
export interface IncomeWithId extends Income {
  id: string;
}

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent],
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.css'],
  providers: [DecimalPipe],
})
export default class IncomeComponent implements OnInit, OnDestroy {
  // Servicios
  private incomeService = inject(IncomeService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService); // ✅ Nuevo
  private authService = inject(AuthService); // ✅ Nuevo
  private loanService = inject(LoanService);
  private debtService = inject(DebtService);
  private expenseService = inject(ExpenseService);
  private finanzasService = inject(FinanzasService);
  private walletService = inject(WalletService);
  private plannerService = inject(PlannerService);

  // Propiedades
  incomes: IncomeWithId[] = [];
  expenses: any[] = [];
  wallet: WalletAccountWithId[] = [];
  loans: any[] = [];
  debts: Debt[] = [];

  // Variables para modales de agregar valor y eliminar
  isAddValueModalOpen: boolean = false;
  isDeleteModalOpen: boolean = false;
  selectedIncomeId: string | null = null;
  incomeToDeleteId: string | null = null;
  newValue: number = 0;

  // Crear Billetera
  isModalOpenW = false;
  newAccount: WalletAccount = new WalletAccount('', 0);

  // estado financiero
  estadoFinanciero: string = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Variable para mostrar toast
  toastMessage: string = '';
  toastVisible: boolean = false;

  // ID de la billetera origen (la que abre el modal)
  sourceWalletId: string | null = null;
  sourceWallet: WalletAccountWithId | null = null;
  insufficientFundsAlert = false;

  // Modal de transaccion
  isTransactionModalOpen = false;
  selectedWallet = '';
  assignedValue: number | null = null;
  totalDisponible = 20000; // Valor quemado por ahora

  // Modales
  isModalOpen: boolean = false;
  isEditModalOpen: boolean = false;

  // Categorías disponibles
  defaultCategorias: string[] = Object.values(CategoriaIngreso);
  categorias: string[] = [...this.defaultCategorias];
  customCategories: string[] = [];
  customCategoryName = '';
  recurringItems: RecurrentItem[] = [];
  editingRecurringIncomeId: string | null = null;
  newRecurringIncome: RecurrentItem = {
    nombre: '',
    categoria: CategoriaIngreso.Fijo,
    monto: 0,
    tipo: 'income',
    activo: true,
  };

  // Ingreso nuevo (modal)
  newIncome: Income = new Income('', CategoriaIngreso.Fijo, null as any);

  // Ingreso en edición (modal)
  editedIncome: Income = new Income('', CategoriaIngreso.Fijo, null as any);
  editedId: string | null = null;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';
  private dateSubscription: Subscription | undefined; // ✅ Nuevo

  // Variables para el gráfico
  ngOnInit() {
    // Suscripción a cambios de fecha
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.plannerService
          .ensureRecurringItemsApplied(
            this.userId,
            this.currentYear,
            this.currentMonth,
            this.incomeService,
            this.expenseService
          )
          .subscribe(() => {
            this.loadPlannerConfig();
            this.loadIncomes();
            this.loadWallets();
          });
      }
    });

    // Estado financiero
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

  // Método para revisar si el total es bajo
  checkLowFunds() {
    this.getTotalWallet();
  }
  // Método para calcular el total de la cartera
  getTotalWallet(): number {
    return this.wallet.reduce((sum, e) => sum + Number(e.valor), 0);
  }

  // Método para cargar todos los datos necesarios y calcular el cuadre
  loadIncomes() {
    this.incomeService
      .getIncomes(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.incomes = Object.entries(data).map(([id, income]) => ({
            id,
            ...income,
          }));
        },
        error: (err) => {
          console.error('❌ Error al cargar ingresos:', err);
        },
      });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  loadWallets() {
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe((data) => {
        this.wallet = Object.entries(data || {}).map(([id, w]) => ({
          id,
          tipo: w.tipo || 'Sin tipo', // ✅ usar tipo en lugar de nombre
          valor: w.valor || 0,
          showMenu: false,
        }));
      });
  }

  loadPlannerConfig() {
    this.plannerService.getCustomCategories(this.userId, 'income').subscribe((categories) => {
      this.customCategories = categories;
      this.categorias = [...this.defaultCategorias, ...categories];
      if (!this.categorias.includes(this.newIncome.categoria)) {
        this.newIncome.categoria = this.categorias[0] || CategoriaIngreso.Fijo;
      }
      if (!this.categorias.includes(this.editedIncome.categoria)) {
        this.editedIncome.categoria = this.categorias[0] || CategoriaIngreso.Fijo;
      }
      if (!this.categorias.includes(this.newRecurringIncome.categoria)) {
        this.newRecurringIncome.categoria = this.categorias[0] || CategoriaIngreso.Fijo;
      }
    });

    this.plannerService.getRecurringItems(this.userId, 'income').subscribe((items) => {
      this.recurringItems = items;
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

    this.plannerService.saveCustomCategories(this.userId, 'income', updatedCategories).subscribe(() => {
      this.customCategoryName = '';
      this.loadPlannerConfig();
    });
  }

  removeCustomCategory(category: string) {
    const updatedCategories = this.customCategories.filter((item) => item !== category);
    this.plannerService.saveCustomCategories(this.userId, 'income', updatedCategories).subscribe(() => {
      this.loadPlannerConfig();
    });
  }

  addRecurringIncome() {
    if (!this.newRecurringIncome.nombre.trim() || this.newRecurringIncome.monto <= 0) {
      return;
    }

    const payload: RecurrentItem = {
      ...this.newRecurringIncome,
      nombre: this.newRecurringIncome.nombre.trim(),
      categoria: this.newRecurringIncome.categoria,
      tipo: 'income',
      activo: true,
    };

    const request = this.editingRecurringIncomeId
      ? this.plannerService.updateRecurringItem(this.userId, this.editingRecurringIncomeId, payload)
      : this.plannerService.addRecurringItem(this.userId, payload);

    request.subscribe(() => {
      this.resetRecurringIncomeForm();
      this.loadPlannerConfig();
    });
  }

  onRecurringIncomeAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');
    const value = Number(raw) || 0;
    this.newRecurringIncome.monto = value;
    input.value = this.formatCurrency(value);
  }

  startEditRecurringIncome(item: RecurrentItem) {
    this.editingRecurringIncomeId = item.id || null;
    this.newRecurringIncome = {
      nombre: item.nombre,
      categoria: item.categoria,
      monto: item.monto,
      tipo: 'income',
      activo: item.activo,
    };
  }

  toggleRecurringIncome(item: RecurrentItem) {
    if (!item.id) return;
    this.plannerService
      .updateRecurringItem(this.userId, item.id, { ...item, activo: !item.activo })
      .subscribe(() => this.loadPlannerConfig());
  }

  resetRecurringIncomeForm() {
    this.editingRecurringIncomeId = null;
    this.newRecurringIncome = {
      nombre: '',
      categoria: this.categorias[0] || CategoriaIngreso.Fijo,
      monto: 0,
      tipo: 'income',
      activo: true,
    };
  }

  deleteRecurringIncome(itemId?: string) {
    if (!itemId) return;
    this.plannerService.deleteRecurringItem(this.userId, itemId).subscribe(() => {
      if (this.editingRecurringIncomeId === itemId) {
        this.resetRecurringIncomeForm();
      }
      this.loadPlannerConfig();
    });
  }

  isCustomCategoryInUse(category: string): boolean {
    const usedInIncomes = this.incomes.some((item) => item.categoria === category);
    const usedInRecurring = this.recurringItems.some((item) => item.categoria === category);
    return usedInIncomes || usedInRecurring;
  }

  // ======================
  // Modal: Agregar Ingreso
  // ======================
  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.newIncome = new Income('', CategoriaIngreso.Fijo, 0);
  }

  addIncome() {
    if (!this.newIncome.nombre || !this.newIncome.categoria) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.incomeService
      .addIncome(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.newIncome
      )
      .subscribe({
        next: () => {
          this.loadIncomes();
          this.closeModal();
        },
        error: (err) => {
          console.error('Error al agregar ingreso:', err);
        },
      });
  }

  // ======================
  // Modal: Agregar Billetera
  // ======================
  openModalW() {
    this.isModalOpenW = true;
  }

  closeModalW() {
    this.isModalOpenW = false;
    this.newAccount = new WalletAccount('', 0);
  }

  addAccountW() {
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
          this.loadWallets(); // solo recargamos las billeteras
          this.closeModalW(); // cerramos correctamente el modal
        },
        error: (err) => {
          console.error('Error al agregar cuenta:', err);
        },
      });
  }

  // ======================
  // Modal: Agregar Valor en Ingreso
  // ======================
  openAddModal(id: string) {
    this.selectedIncomeId = id;
    this.isAddValueModalOpen = true;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  applyValue(action: 'add' | 'subtract') {
    if (!this.selectedIncomeId) return;

    const income = this.incomes.find((i) => i.id === this.selectedIncomeId);
    if (!income) return;

    let finalValue = this.newValue;

    if (action === 'subtract') {
      finalValue = -Math.abs(this.newValue);
    } else {
      finalValue = Math.abs(this.newValue);
    }

    const updatedValue = income.valor + finalValue;

    const updatedIncome: Income = {
      nombre: income.nombre,
      categoria: income.categoria,
      valor: updatedValue,
    };

    this.incomeService
      .updateIncome(
        this.userId,
        this.currentYear,
        this.currentMonth,
        income.id,
        updatedIncome
      )
      .subscribe({
        next: () => {
          this.loadIncomes();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar ingreso:', err);
        },
      });
  }

  // ======================
  // Modal: Editar Ingreso
  // ======================
  openEditModal(id: string) {
    const original = this.incomes.find((i) => i.id === id);
    if (!original) return;

    this.editedIncome = new Income(
      original.nombre,
      original.categoria,
      original.valor
    );
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedIncome = new Income('', CategoriaIngreso.Fijo, 0);
    this.editedId = null;
  }

  saveEditedIncome() {
    if (!this.editedId) return;

    this.incomeService
      .updateIncome(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        this.editedIncome
      )
      .subscribe({
        next: () => {
          this.loadIncomes();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al editar ingreso:', err);
        },
      });
  }

  // ======================
  // Modal: Eliminar Ingreso
  // ======================
  openDeleteModal(id: string) {
    this.isDeleteModalOpen = true;
    this.incomeToDeleteId = id;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.incomeToDeleteId = null;
  }

  confirmDeleteIncome() {
    if (!this.incomeToDeleteId) return;

    this.incomeService
      .deleteIncome(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.incomeToDeleteId
      )
      .subscribe({
        next: () => {
          this.loadIncomes();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error al eliminar ingreso:', err);
        },
      });
  }

  // ======================
  // Modal: Transaccion
  // ======================
  openTransactionModal() {
    this.isTransactionModalOpen = true;

    // Convertimos assignedValue a positivo para que no se muestre negativo
    this.assignedValue =
      this.cuadreDescuadre < 0 ? -this.cuadreDescuadre : this.cuadreDescuadre;

    if (!this.wallet.length) {
      this.loadWallets();
    }
  }

  closeTransactionModal() {
    this.isTransactionModalOpen = false;
    this.assignedValue = null;
    this.selectedWallet = '';
    this.insufficientFundsAlert = false;
  }

  confirmTransaction() {
    if (
      !this.selectedWallet ||
      !this.assignedValue ||
      this.assignedValue <= 0
    ) {
      alert('Selecciona una billetera y un valor válido.');
      return;
    }

    if (this.assignedValue > Math.abs(this.cuadreDescuadre ?? 0)) {
      this.insufficientFundsAlert = true;
      return;
    }

    const toAccount = this.wallet.find((w) => w.id === this.selectedWallet);
    if (!toAccount) return;

    // Sumar al destino
    toAccount.valor += this.assignedValue;

    // Guardar en DB usando WalletService
    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        toAccount.id,
        { tipo: toAccount.tipo, valor: toAccount.valor }
      )
      .subscribe(() => {
        // Mostrar mensaje de éxito
        this.showToast('Transferencia exitosa');

        // Recargar datos automáticamente
        this.loadWallets();

        // Ajustar cuadre después de la asignación
        this.cuadreDescuadre =
          (this.cuadreDescuadre ?? 0) + (this.assignedValue ?? 0);

        this.closeTransactionModal();

        // Forzar recarga de la página después de 500ms
        setTimeout(() => {
          window.location.reload();
        }, 500);
      });
  }

  // Método para calcular el total de ingresos
  getTotalIncome(): number {
    return this.incomes.reduce((sum, e) => sum + Number(e.valor), 0);
  }

  // Método para calcular el total de ingresos por categoría
  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  // Método para obtener el total estimado de ingresos
  getGroupedIncomes(): { categoria: string; items: IncomeWithId[] }[] {
    const map = new Map<string, IncomeWithId[]>();

    for (const income of this.incomes) {
      const cat = income.categoria;
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(income);
    }

    return Array.from(map.entries()).map(([categoria, items]) => ({
      categoria,
      items,
    }));
  }

  // Método para calcular el total por categoría
  getGroupTotal(items: IncomeWithId[]) {
    return items.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }

  // Método para calcular el cuadre/descuadre
  onValueInput(event: Event, field: 'valor' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;

    if (field === 'valor') {
      this.newIncome.valor = value;
    } else if (field === 'add') {
      this.newValue = value;
    }

    input.value = this.formatCurrency(value);
  }

  onValueInputW(event: Event, type: 'new' | 'edit' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;

    if (type === 'new') {
      this.newAccount.valor = value;
    } else if (type === 'add') {
      this.newValue = value;
    }

    input.value = this.formatCurrency(value);
  }

  // Método para manejar la entrada de valores y formatear
  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[.,]/g, '');
    const value = Number(raw) || 0;
    this.editedIncome.valor = value;
    input.value = this.formatCurrency(value);
  }

  // Cuando el usuario escribe en el input de asignar dinero
  onAssignedValueInput(event: Event) {
    const input = event.target as HTMLInputElement;

    // Quitamos cualquier carácter que no sea número
    const rawValue = input.value.replace(/[^\d]/g, '');

    // Convertimos a número
    let numericValue = Number(rawValue) || 0;

    // Limitar a lo disponible
    if (numericValue > Math.abs(this.cuadreDescuadre)) {
      numericValue = Math.abs(this.cuadreDescuadre);
      this.insufficientFundsAlert = true; // Mostrar alerta
    } else {
      this.insufficientFundsAlert = false;
    }

    // Guardamos en la variable vinculada
    this.assignedValue = numericValue;

    // Volvemos a formatear el input con comas
    input.value = this.formatCurrency(numericValue);
  }

  // Método que convierte 1000 -> 1,000
  formatCurrencyA(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('en-US'); // separador de miles con coma
  }

  showToast(message: string, duration: number = 2000) {
    this.toastMessage = message;
    this.toastVisible = true;

    setTimeout(() => {
      this.toastVisible = false;
    }, duration);
  }

  getRowAnimationDelay(income: IncomeWithId) {
    const index = this.incomes.indexOf(income);
    return `${0.2 + index * 0.1}s`; // empieza 0.2s, aumenta 0.1s por fila
  }
}
