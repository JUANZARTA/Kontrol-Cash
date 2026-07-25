import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { SavingsService } from '../../services/savings.service';
import { Saving, SavingMovement, SavingMovementWithId, SavingWithId } from '../../models/savings.model';
import { DateService } from '../../services/date.service';
import { FinanzasService } from '../../services/finanzas.service';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './savings.component.html',
  styleUrls: ['./savings.component.css'],
  providers: [DecimalPipe],
})
export default class SavingsComponent implements OnInit, OnDestroy {
  private savingsService = inject(SavingsService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);
  private finanzasService = inject(FinanzasService);
  private route = inject(ActivatedRoute);

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;
  currentYear = '';
  currentMonth = '';
  private dateSubscription: Subscription | undefined;

  estadoFinanciero = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;
  incomes: any[] = [];
  expenses: any[] = [];
  wallet: any[] = [];
  loans: any[] = [];

  piggybanks: SavingWithId[] = [];
  selectedPiggybank: SavingWithId | null = null;
  movements: SavingMovementWithId[] = [];
  requestedPiggybankId: string | null = null;

  viewMode: 'list' | 'detail' = 'list';

  isPiggybankModalOpen = false;
  isEditPiggybankModalOpen = false;
  isDeletePiggybankModalOpen = false;

  isMovementModalOpen = false;
  isEditMovementModalOpen = false;
  isDeleteMovementModalOpen = false;
  isAdjustMovementModalOpen = false;

  newPiggybank: Saving = new Saving('', 0, '', 0);
  editedPiggybank: Saving = new Saving('', 0, '', 0);
  piggybankToDeleteId: string | null = null;
  editedPiggybankId: string | null = null;

  newMovement: SavingMovement = { nombre: '', valor: 0 };
  editedMovement: SavingMovement = { nombre: '', valor: 0 };
  movementToDeleteId: string | null = null;
  editedMovementId: string | null = null;
  selectedMovementId: string | null = null;
  adjustMovementValue = 0;

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      this.requestedPiggybankId = params.get('piggybank');
    });

    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadPiggybanks();
      }
    });
  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  loadPiggybanks() {
    this.savingsService.getSavings(this.userId, this.currentYear, this.currentMonth).subscribe({
      next: (data) => {
        this.piggybanks = Object.entries(data).map(([id, p]: [string, any]) => ({
          id,
          tipo: (p?.tipo || p?.nombre || '').trim(),
          nombre: (p?.nombre || p?.tipo || '').trim(),
          valor: Number(p?.valor || 0),
          metaAhorro: Number(p?.metaAhorro || 0),
        }));

        if (this.viewMode === 'detail' && this.selectedPiggybank) {
          const refreshed = this.piggybanks.find((p) => p.id === this.selectedPiggybank!.id) || null;
          this.selectedPiggybank = refreshed;
          if (refreshed) this.loadMovements(refreshed.id);
        }

        if (this.requestedPiggybankId) {
          const requested = this.piggybanks.find((p) => p.id === this.requestedPiggybankId);
          if (requested) {
            this.enterPiggybank(requested.id);
            this.requestedPiggybankId = null;
          }
        }
      },
      error: (err) => console.error('Error al cargar alcancías:', err),
    });

    this.finanzasService.mostrarEstadoFinanciero(this, this.userId, this.currentYear, this.currentMonth);
  }

  loadMovements(piggybankId: string) {
    this.savingsService
      .getSavingMovements(this.userId, this.currentYear, this.currentMonth, piggybankId)
      .subscribe((data) => {
        this.movements = Object.entries(data || {}).map(([id, m]: [string, any]) => ({
          id,
          nombre: (m?.nombre || '').trim(),
          valor: Number(m?.valor || 0),
        }));
      });
  }

  openPiggybankModal() {
    this.newPiggybank = new Saving('', 0, '', 0);
    this.isPiggybankModalOpen = true;
  }

  closePiggybankModal() {
    this.isPiggybankModalOpen = false;
  }

  addPiggybank() {
    const nombre = (this.newPiggybank.nombre || this.newPiggybank.tipo || '').trim();
    if (!nombre) {
      alert('El nombre de la alcancía es obligatorio.');
      return;
    }

    const payload: Saving = {
      tipo: nombre,
      nombre,
      metaAhorro: Math.max(0, Number(this.newPiggybank.metaAhorro || 0)),
      valor: Math.max(0, Number(this.newPiggybank.valor || 0)),
    };

    this.savingsService.addSaving(this.userId, this.currentYear, this.currentMonth, payload).subscribe({
      next: () => {
        this.closePiggybankModal();
        this.loadPiggybanks();
      },
      error: (err) => console.error('Error al crear alcancía:', err),
    });
  }

  openEditPiggybankModal(id: string) {
    const p = this.piggybanks.find((x) => x.id === id);
    if (!p) return;
    this.editedPiggybankId = id;
    this.editedPiggybank = new Saving(p.tipo, p.valor, p.nombre, p.metaAhorro || 0);
    this.isEditPiggybankModalOpen = true;
  }

  closeEditPiggybankModal() {
    this.isEditPiggybankModalOpen = false;
    this.editedPiggybankId = null;
  }

  saveEditedPiggybank() {
    if (!this.editedPiggybankId) return;
    const nombre = (this.editedPiggybank.nombre || this.editedPiggybank.tipo || '').trim();
    if (!nombre) {
      alert('El nombre de la alcancía es obligatorio.');
      return;
    }

    const payload: Saving = {
      tipo: nombre,
      nombre,
      metaAhorro: Math.max(0, Number(this.editedPiggybank.metaAhorro || 0)),
      valor: Math.max(0, Number(this.editedPiggybank.valor || 0)),
    };

    this.savingsService
      .updateSaving(this.userId, this.currentYear, this.currentMonth, this.editedPiggybankId, payload)
      .subscribe({ next: () => { this.closeEditPiggybankModal(); this.loadPiggybanks(); } });
  }

  openDeletePiggybankModal(id: string) {
    this.piggybankToDeleteId = id;
    this.isDeletePiggybankModalOpen = true;
  }

  closeDeletePiggybankModal() {
    this.isDeletePiggybankModalOpen = false;
    this.piggybankToDeleteId = null;
  }

  confirmDeletePiggybank() {
    if (!this.piggybankToDeleteId) return;
    this.savingsService
      .deleteSaving(this.userId, this.currentYear, this.currentMonth, this.piggybankToDeleteId)
      .subscribe({
        next: () => {
          if (this.selectedPiggybank?.id === this.piggybankToDeleteId) {
            this.backToPiggybanks();
          }
          this.closeDeletePiggybankModal();
          this.loadPiggybanks();
        },
      });
  }

  enterPiggybank(id: string) {
    const selected = this.piggybanks.find((x) => x.id === id);
    if (!selected) return;
    this.selectedPiggybank = selected;
    this.viewMode = 'detail';
    this.loadMovements(id);
  }

  backToPiggybanks() {
    this.viewMode = 'list';
    this.selectedPiggybank = null;
    this.movements = [];
  }

  openMovementModal() {
    this.newMovement = { nombre: '', valor: 0 };
    this.isMovementModalOpen = true;
  }

  closeMovementModal() {
    this.isMovementModalOpen = false;
  }

  addMovement(action: 'add' | 'subtract') {
    if (!this.selectedPiggybank) return;
    const nombre = (this.newMovement.nombre || '').trim();
    if (!nombre || this.newMovement.valor <= 0) {
      alert('Completa nombre y valor del movimiento.');
      return;
    }

    const signedValue = action === 'subtract' ? -Math.abs(this.newMovement.valor) : Math.abs(this.newMovement.valor);
    const movementPayload: SavingMovement = { nombre, valor: signedValue };
    const piggy = this.selectedPiggybank;
    const updatedPiggy: Saving = {
      tipo: this.getPiggybankName(piggy),
      nombre: this.getPiggybankName(piggy),
      metaAhorro: piggy.metaAhorro || 0,
      valor: Math.max(0, Number(piggy.valor || 0) + signedValue),
    };

    this.savingsService
      .addSavingMovement(this.userId, this.currentYear, this.currentMonth, piggy.id, movementPayload)
      .subscribe({
        next: () => {
          this.savingsService
            .updateSaving(this.userId, this.currentYear, this.currentMonth, piggy.id, updatedPiggy)
            .subscribe({
              next: () => {
                this.closeMovementModal();
                this.loadPiggybanks();
              },
            });
        },
      });
  }

  openEditMovementModal(id: string) {
    const movement = this.movements.find((m) => m.id === id);
    if (!movement) return;
    this.editedMovementId = id;
    this.editedMovement = { ...movement };
    this.isEditMovementModalOpen = true;
  }

  closeEditMovementModal() {
    this.isEditMovementModalOpen = false;
    this.editedMovementId = null;
  }

  saveEditedMovement() {
    if (!this.selectedPiggybank || !this.editedMovementId) return;
    const original = this.movements.find((m) => m.id === this.editedMovementId);
    if (!original) return;
    const piggy = this.selectedPiggybank;

    const newNombre = (this.editedMovement.nombre || '').trim();
    if (!newNombre) return;

    const diff = Number(this.editedMovement.valor || 0) - Number(original.valor || 0);
    const updatedPiggy: Saving = {
      tipo: this.getPiggybankName(piggy),
      nombre: this.getPiggybankName(piggy),
      metaAhorro: piggy.metaAhorro || 0,
      valor: Math.max(0, Number(piggy.valor || 0) + diff),
    };

    this.savingsService
      .updateSavingMovement(this.userId, this.currentYear, this.currentMonth, piggy.id, this.editedMovementId, {
        nombre: newNombre,
        valor: Number(this.editedMovement.valor || 0),
      })
      .subscribe({
        next: () => {
          this.savingsService.updateSaving(this.userId, this.currentYear, this.currentMonth, piggy.id, updatedPiggy).subscribe({
            next: () => {
              this.closeEditMovementModal();
              this.loadPiggybanks();
            },
          });
        },
      });
  }

  openDeleteMovementModal(id: string) {
    this.movementToDeleteId = id;
    this.isDeleteMovementModalOpen = true;
  }

  closeDeleteMovementModal() {
    this.isDeleteMovementModalOpen = false;
    this.movementToDeleteId = null;
  }

  confirmDeleteMovement() {
    if (!this.selectedPiggybank || !this.movementToDeleteId) return;
    const movement = this.movements.find((m) => m.id === this.movementToDeleteId);
    if (!movement) return;
    const piggy = this.selectedPiggybank;
    const updatedPiggy: Saving = {
      tipo: this.getPiggybankName(piggy),
      nombre: this.getPiggybankName(piggy),
      metaAhorro: piggy.metaAhorro || 0,
      valor: Math.max(0, Number(piggy.valor || 0) - Number(movement.valor || 0)),
    };

    this.savingsService
      .deleteSavingMovement(this.userId, this.currentYear, this.currentMonth, piggy.id, this.movementToDeleteId)
      .subscribe({
        next: () => {
          this.savingsService.updateSaving(this.userId, this.currentYear, this.currentMonth, piggy.id, updatedPiggy).subscribe({
            next: () => {
              this.closeDeleteMovementModal();
              this.loadPiggybanks();
            },
          });
        },
      });
  }

  openAdjustMovementModal(id: string) {
    this.selectedMovementId = id;
    this.adjustMovementValue = 0;
    this.isAdjustMovementModalOpen = true;
  }

  closeAdjustMovementModal() {
    this.isAdjustMovementModalOpen = false;
    this.selectedMovementId = null;
    this.adjustMovementValue = 0;
  }

  applyAdjustMovement(action: 'add' | 'subtract') {
    if (!this.selectedPiggybank || !this.selectedMovementId) return;
    const movement = this.movements.find((m) => m.id === this.selectedMovementId);
    if (!movement) return;

    const delta = action === 'subtract' ? -Math.abs(this.adjustMovementValue) : Math.abs(this.adjustMovementValue);
    const updatedMovement: SavingMovement = {
      nombre: movement.nombre,
      valor: Number(movement.valor || 0) + delta,
    };

    const piggy = this.selectedPiggybank;
    const updatedPiggy: Saving = {
      tipo: this.getPiggybankName(piggy),
      nombre: this.getPiggybankName(piggy),
      metaAhorro: piggy.metaAhorro || 0,
      valor: Math.max(0, Number(piggy.valor || 0) + delta),
    };

    this.savingsService
      .updateSavingMovement(this.userId, this.currentYear, this.currentMonth, piggy.id, movement.id, updatedMovement)
      .subscribe({
        next: () => {
          this.savingsService.updateSaving(this.userId, this.currentYear, this.currentMonth, piggy.id, updatedPiggy).subscribe({
            next: () => {
              this.closeAdjustMovementModal();
              this.loadPiggybanks();
            },
          });
        },
      });
  }

  savePiggybankGoal() {
    if (!this.selectedPiggybank) return;
    const piggy = this.selectedPiggybank;
    const payload: Saving = {
      tipo: this.getPiggybankName(piggy),
      nombre: this.getPiggybankName(piggy),
      valor: Number(piggy.valor || 0),
      metaAhorro: Math.max(0, Number(piggy.metaAhorro || 0)),
    };
    this.savingsService.updateSaving(this.userId, this.currentYear, this.currentMonth, piggy.id, payload).subscribe({
      next: () => this.loadPiggybanks(),
    });
  }

  getPiggybankName(p: SavingWithId): string {
    return (p.nombre || p.tipo || 'Alcancía').trim();
  }

  getPiggybankProgress(p: SavingWithId): number {
    if (!p.metaAhorro) return 0;
    return Math.min(100, Math.round((Number(p.valor || 0) / Number(p.metaAhorro || 0)) * 100));
  }

  getTotalSavings(): number {
    return this.piggybanks.reduce((sum, p) => sum + Number(p.valor || 0), 0);
  }

  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  formatCurrencyInput(value: number): string {
    return value ? this.formatCurrency(value) : '';
  }

  abs(value: number): number {
    return Math.abs(value || 0);
  }

  onValueInput(event: Event, type: 'piggy' | 'piggyEdit' | 'movement' | 'movementEdit' | 'goal' | 'movementAdjust') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    if (type === 'piggy') this.newPiggybank.valor = value;
    if (type === 'piggyEdit') this.editedPiggybank.valor = value;
    if (type === 'movement') this.newMovement.valor = value;
    if (type === 'movementEdit') this.editedMovement.valor = value;
    if (type === 'movementAdjust') this.adjustMovementValue = value;
    if (type === 'goal' && this.selectedPiggybank) this.selectedPiggybank.metaAhorro = value;
    input.value = value ? this.formatCurrency(value) : '';
  }

  onNewPiggybankGoalInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d]/g, '');
    const value = Number(raw) || 0;
    this.newPiggybank.metaAhorro = value;
    input.value = value ? this.formatCurrency(value) : '';
  }

  onEditPiggybankGoalInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d]/g, '');
    const value = Number(raw) || 0;
    this.editedPiggybank.metaAhorro = value;
    input.value = value ? this.formatCurrency(value) : '';
  }

  getSavingCardClass(index: number): string {
    const classes = ['piggy-card--sky', 'piggy-card--mint', 'piggy-card--violet', 'piggy-card--amber'];
    return classes[index % classes.length];
  }

  getRowAnimationDelay(_: any, index?: number): string {
    const i = index ?? 0;
    return `${0.1 + i * 0.05}s`;
  }
}
