import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SavingsService } from '../../services/savings.service';
import { Saving } from '../../models/savings.model';
import { DateService } from '../../services/date.service'; // ✅ Nuevo
import { Subscription } from 'rxjs'; // ✅ Nuevo
import { AuthService } from '../../services/auth.service'; // ✅ nuevo
import { FinanzasService } from '../../services/finanzas.service';
import { MatIconModule } from '@angular/material/icon';

export interface SavingWithId extends Saving {
  id: string;
}

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './savings.component.html',
  styleUrls: ['./savings.component.css'],
  providers: [DecimalPipe],
})
export default class SavingsComponent implements OnInit, OnDestroy {
  // Servicios
  private savingsService = inject(SavingsService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);
  private authService = inject(AuthService);
  private finanzasService = inject(FinanzasService);
// Variables para modales de agregar valor y eliminar
isAddValueModalOpen: boolean = false;
isDeleteModalOpen: boolean = false;
selectedSavingId: string | null = null;
savingToDeleteId: string | null = null;
newValue: number = 0;

  // Datos
  savings: SavingWithId[] = [];
  incomes: any[] = [];
  expenses: any[] = [];
  wallet: any[] = [];
  loans: any[] = [];

  estadoFinanciero = '';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Ahorro nuevo
  newSaving: Saving = new Saving('', 0);

  // Ahorro en edición
  editedSaving: Saving = new Saving('', 0);
  editedId: string | null = null;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';
  private dateSubscription: Subscription | undefined; // ✅ Nuevo

  ngOnInit() {
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadSavings();
      }
    });this.finanzasService.mostrarEstadoFinanciero(this, this.userId, this.currentYear, this.currentMonth);

  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  loadSavings() {
    this.savingsService
      .getSavings(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.savings = Object.entries(data).map(([id, s]) => ({ id, ...s }));

          // ✅ Notificación: no has ahorrado este mes
          if (this.savings.length === 0) {
            this.authService
              .addNotification(
                this.userId, 
                'No has ahorrado este mes',
                'sin_ahorro_mes'
              )
              .subscribe();
          }
        },

        error: (err) => {
          console.error('Error al cargar ahorros:', err);
        },
      });this.finanzasService.mostrarEstadoFinanciero(this, this.userId, this.currentYear, this.currentMonth);

  }

  // ======================
// Modal: Agregar Ahorro
// ======================
openModal() {
  this.isModalOpen = true;
}

closeModal() {
  this.isModalOpen = false;
  this.newSaving = new Saving('', 0);
}

addSaving() {
  if (!this.newSaving.tipo) {
    alert('Por favor completa todos los campos.');
    return;
  }

  this.savingsService.addSaving(
    this.userId,
    this.currentYear,
    this.currentMonth,
    this.newSaving
  ).subscribe({
    next: () => {
      this.loadSavings();
      this.closeModal();
      this.authService.addNotification(this.userId, 'Has agregado dinero a tus ahorros').subscribe();
    },
    error: (err) => {
      console.error('Error al agregar ahorro:', err);
    }
  });
}

// ======================
// Modal: Agregar Valor en Ahorro
// ======================
openAddModal(id: string) {
  this.selectedSavingId = id;
  this.isAddValueModalOpen = true;
}

closeAddValueModal() {
  this.isAddValueModalOpen = false;
  this.newValue = 0;
}

applyValue(action: 'add' | 'subtract') {
  if (!this.selectedSavingId) return;

  const saving = this.savings.find(s => s.id === this.selectedSavingId);
  if (!saving) return;

  let finalValue = this.newValue;

  if (action === 'subtract') {
    finalValue = -Math.abs(this.newValue);
  } else {
    finalValue = Math.abs(this.newValue);
  }

  const updatedValue = saving.valor + finalValue;

  const updatedSaving: Saving = {
    tipo: saving.tipo,
    valor: updatedValue
  };

  this.savingsService.updateSaving(
    this.userId,
    this.currentYear,
    this.currentMonth,
    saving.id,
    updatedSaving
  ).subscribe({
    next: () => {
      this.loadSavings();
      this.closeAddValueModal();
    },
    error: (err) => {
      console.error('Error al actualizar ahorro:', err);
    }
  });
}

// ======================
// Modal: Editar Ahorro
// ======================
openEditModal(id: string) {
  const original = this.savings.find(s => s.id === id);
  if (!original) return;

  this.editedSaving = new Saving(original.tipo, original.valor);
  this.editedId = id;
  this.isEditModalOpen = true;
}

closeEditModal() {
  this.isEditModalOpen = false;
  this.editedSaving = new Saving('', 0);
  this.editedId = null;
}

saveEditedSaving() {
  if (!this.editedId) return;

  this.savingsService.updateSaving(
    this.userId,
    this.currentYear,
    this.currentMonth,
    this.editedId,
    this.editedSaving
  ).subscribe({
    next: () => {
      this.loadSavings();
      this.closeEditModal();
    },
    error: (err) => {
      console.error('Error al actualizar ahorro:', err);
    }
  });
}

// ======================
// Modal: Eliminar Ahorro
// ======================
openDeleteModal(id: string) {
  this.isDeleteModalOpen = true;
  this.savingToDeleteId = id;
}

closeDeleteModal() {
  this.isDeleteModalOpen = false;
  this.savingToDeleteId = null;
}

confirmDeleteSaving() {
  if (!this.savingToDeleteId) return;

  this.savingsService.deleteSaving(
    this.userId,
    this.currentYear,
    this.currentMonth,
    this.savingToDeleteId
  ).subscribe({
    next: () => {
      this.loadSavings();
      this.closeDeleteModal();
    },
    error: (err) => {
      console.error('Error al eliminar ahorro:', err);
    }
  });
}


  getTotalSavings(): number {
    return this.savings.reduce((sum, e) => sum + Number(e.valor), 0);
  }

  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }
  onValueInput(event: Event, type: 'new' | 'edit' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
  
    if (type === 'new') {
      this.newSaving.valor = value;
    } else if (type === 'edit') {
      this.editedSaving.valor = value;
    } else if (type === 'add') {
      this.newValue = value;
    }
  
    input.value = this.formatCurrency(value);
  }
  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    this.editedSaving.valor = value;
    input.value = this.formatCurrency(value);
  }
  
}
