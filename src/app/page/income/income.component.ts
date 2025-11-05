import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncomeService } from '../../services/income.service';
import { CategoriaIngreso, Income } from '../../models/income.model';
import { DateService } from '../../services/date.service'; // ✅ Nuevo
import { Subscription } from 'rxjs'; // ✅ Nuevo
import { AuthService } from '../../services/auth.service'; // ✅ Nuevo
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';
import { WalletAccount } from '../../models/wallet.model';
import { WalletService } from '../../services/wallet.service';

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
  imports: [CommonModule, FormsModule, MatIconModule],
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
  private finanzasService = inject(FinanzasService);
  private walletService = inject(WalletService);

  // Propiedades
  incomes: IncomeWithId[] = [];
  expenses: any[] = [];
  wallet: WalletAccountWithId[] = [];
  loans: any[] = [];

  // Variables para modales de agregar valor y eliminar
  isAddValueModalOpen: boolean = false;
  isDeleteModalOpen: boolean = false;
  selectedIncomeId: string | null = null;
  incomeToDeleteId: string | null = null;
  newValue: number = 0;

  // estado financiero
  estadoFinanciero = '';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

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
  categorias: string[] = Object.values(CategoriaIngreso);

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
        this.loadIncomes();
        this.loadWallets(); // ✅ carga billeteras al iniciar
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
        { tipo: toAccount.tipo, valor: toAccount.valor } // ✅ reemplazamos nombre por tipo
      )

      .subscribe(() => {
        this.loadWallets(); // refresca la lista
        this.closeTransactionModal();
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

  // Método para manejar la entrada de valores y formatear
  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[.,]/g, '');
    const value = Number(raw) || 0;
    this.editedIncome.valor = value;
    input.value = this.formatCurrency(value);
  }
}
