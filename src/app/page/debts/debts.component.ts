import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DebtService } from '../../services/debts.service';
import { Debt } from '../../models/debt.model';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';

export interface DebtWithId extends Debt {
  id: string;
}

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.css'],
  providers: [DecimalPipe],
})
export default class DebtsComponent implements OnInit, OnDestroy {
  // Servicios
  private debtService = inject(DebtService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService); // ✅ Nuevo
  private authService = inject(AuthService); // ✅ nuevo
  private finanzasService = inject(FinanzasService);

  // Variables
  selectedDebtId: string | null = null;

  // Datos de la deuda
  incomes: any[] = [];
  expenses: any[] = [];
  wallet: any[] = [];
  loans: any[] = [];

  // Estado financiero
  estadoFinanciero = '';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Nuevo Modal de Eliminar
  isDeleteModalOpen = false;
  debtToDeleteId: string | null = null;

  // Nuevo Modal de Agregar Valor
  isAddValueModalOpen = false;
  newValue: number = 0;

  // Datos
  debts: DebtWithId[] = [];

  // Modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Edición
  editedDebt: Debt = new Debt('', '', '', 0, 'Pendiente');
  editedId: string | null = null;

  // Deuda nueva
  newDebt: Debt = new Debt('', '', '', 0, 'Pendiente');

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

          const today = new Date().toISOString().split('T')[0];

          for (const debt of this.debts) {
            if (debt.estado === 'Pendiente') {
              // ✅ Deuda vence hoy
              if (debt.fecha_pago === today) {
                this.authService
                  .addNotification(
                    this.userId,
                    `Tienes una deuda que vence hoy con ${debt.acreedor}`,
                    `deuda_vence_hoy_${debt.id}`
                  )
                  .subscribe();
              }

              // ✅ Deuda vencida
              if (new Date(debt.fecha_pago) < new Date(today)) {
                this.authService
                  .addNotification(
                    this.userId,
                    `Tienes una deuda vencida con ${debt.acreedor}`,
                    `deuda_vencida_${debt.id}`
                  )
                  .subscribe();
              }
            }
          }
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

    const debt = this.debts.find(d => d.id === this.selectedDebtId);
    if (!debt) return;

    const updatedValue = debt.valor + this.newValue;

    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: updatedValue,
      estado: debt.estado,
    };

    this.debtService.updateDebt(
      this.userId,
      this.currentYear,
      this.currentMonth,
      debt.id,
      updatedDebt
    ).subscribe({
      next: () => {
        this.loadDebts();
        this.closeAddValueModal();
      },
      error: (err) => {
        console.error('Error al actualizar valor de deuda:', err);
      }
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
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedDebt = new Debt('', '', '', 0, 'Pendiente');
    this.editedId = null;
  }

  saveEditedDebt() {
    if (!this.editedId) return;

    this.debtService
      .updateDebt(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        this.editedDebt
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
    const updatedStatus = (
      debt.estado === 'Pendiente' ? 'Pagado' : 'Pendiente'
    ) as 'Pendiente' | 'Pagado';

    const updatedDebt: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: debt.valor,
      estado: updatedStatus,
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

          // ✅ Notificar si la deuda fue pagada
          if (updatedStatus === 'Pagado') {
            this.authService
              .addNotification(
                this.userId,
                `Pagaste tu deuda con ${debt.acreedor} correctamente`
              )
              .subscribe();
          }
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
      .reduce((sum, debt) => sum + Number(debt.valor), 0);
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

    const debt = this.debts.find(d => d.id === this.selectedDebtId);
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
    };

    this.debtService.updateDebt(
      this.userId,
      this.currentYear,
      this.currentMonth,
      debt.id,
      updatedDebt
    ).subscribe({
      next: () => {
        this.loadDebts();
        this.closeAddValueModal();
      },
      error: (err) => {
        console.error('Error al actualizar deuda:', err);
      }
    });
  }

}
