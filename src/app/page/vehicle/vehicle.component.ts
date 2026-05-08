import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { DateService } from '../../services/date.service';
import { VehicleService } from '../../services/vehicle.service';
import { FuelEntry, FuelEntryWithId, FuelPump, FuelPumpWithId } from '../../models/vehicle.model';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { ThemeService } from '../../services/theme.service';
import { WalletService } from '../../services/wallet.service';
import { ExpenseService } from '../../services/expense.service';
import { Expense } from '../../models/expense.model';

Chart.register(...registerables);

@Component({
  selector: 'app-vehicle',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './vehicle.component.html',
  styleUrls: ['./vehicle.component.css'],
  providers: [DecimalPipe],
})
export default class VehicleComponent implements OnInit, AfterViewInit, OnDestroy {
  private vehicleService = inject(VehicleService);
  private dateService = inject(DateService);
  private decimalPipe = inject(DecimalPipe);
  private themeService = inject(ThemeService);
  private walletService = inject(WalletService);
  private expenseService = inject(ExpenseService);

  @ViewChild('vehicleChart') vehicleChartRef!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private dateSub?: Subscription;
  private themeSub?: Subscription;

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;
  currentYear = '';
  currentMonth = '';

  entries: FuelEntryWithId[] = [];
  pumps: FuelPumpWithId[] = [];
  wallets: Array<{ id: string; tipo: string; valor: number }> = [];
  selectedPumpId = '';
  selectedWalletId = '';
  newEntry: FuelEntry = { nombreBomba: '', monto: 0, galones: 0, kilometraje: 0, fecha: '' };
  editedEntry: FuelEntry = { nombreBomba: '', monto: 0, galones: 0, kilometraje: 0, fecha: '' };
  editedId: string | null = null;
  entryToDeleteId: string | null = null;

  isAddModalOpen = false;
  isEditModalOpen = false;
  isDeleteModalOpen = false;
  isPumpModalOpen = false;
  isPumpEditModalOpen = false;
  isPumpDeleteModalOpen = false;
  newPump: FuelPump = { nombre: '', precioGalon: 0 };
  editedPump: FuelPump = { nombre: '', precioGalon: 0 };
  editedPumpId: string | null = null;
  pumpToDeleteId: string | null = null;

  ngOnInit(): void {
    this.dateSub = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadEntries();
        this.loadWallets();
        this.loadPumps();
      }
    });

    this.themeSub = this.themeService.theme$.subscribe(() => this.refreshChart());
  }

  ngAfterViewInit(): void {
    this.refreshChart();
  }

  ngOnDestroy(): void {
    this.dateSub?.unsubscribe();
    this.themeSub?.unsubscribe();
    this.chart?.destroy();
  }

  loadEntries(): void {
    this.vehicleService.getFuelEntries(this.userId, this.currentYear, this.currentMonth).subscribe((data) => {
      this.entries = Object.entries(data || {})
        .map(([id, item]: [string, any]) => ({ id, ...item }))
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      this.refreshChart();
    });
  }

  addEntry(): void {
    if (!this.newEntry.fecha || this.newEntry.kilometraje <= 0 || this.newEntry.monto <= 0) {
      alert('Completá todos los campos con valores válidos.');
      return;
    }

    if (!this.selectedPumpId) {
      alert('Seleccioná una bomba.');
      return;
    }

    const selectedPump = this.pumps.find((p) => p.id === this.selectedPumpId);
    if (!selectedPump || selectedPump.precioGalon <= 0) {
      alert('La bomba seleccionada no tiene precio por galón válido.');
      return;
    }

    if (!this.selectedWalletId) {
      alert('Seleccioná una billetera para descontar el tanqueo.');
      return;
    }

    const selectedWallet = this.wallets.find((w) => w.id === this.selectedWalletId);
    if (!selectedWallet) {
      alert('La billetera seleccionada no existe.');
      return;
    }

    if (this.newEntry.monto > selectedWallet.valor) {
      alert('El monto supera el saldo disponible de la billetera.');
      return;
    }

    const galonesCalculados = this.newEntry.monto / selectedPump.precioGalon;
    const payload: FuelEntry = {
      ...this.newEntry,
      bombaId: selectedPump.id,
      nombreBomba: selectedPump.nombre,
      precioGalon: selectedPump.precioGalon,
      galones: galonesCalculados,
      walletId: this.selectedWalletId,
    };

    this.vehicleService.addFuelEntry(this.userId, this.currentYear, this.currentMonth, payload).subscribe(() => {
      const updatedWallet = {
        tipo: selectedWallet.tipo,
        valor: selectedWallet.valor - this.newEntry.monto,
      };
      this.walletService.updateAccount(
        this.userId, this.currentYear, this.currentMonth, selectedWallet.id, updatedWallet
      ).subscribe(() => {
        this.closeAddModal();
        this.reloadAndSync();
        this.loadWallets();
      });
    });
  }

  openAddModal(): void {
    this.newEntry = { nombreBomba: '', monto: 0, galones: 0, kilometraje: 0, fecha: '' };
    this.selectedPumpId = '';
    this.selectedWalletId = '';
    this.isAddModalOpen = true;
  }

  closeAddModal(): void { this.isAddModalOpen = false; }

  loadWallets(): void {
    this.walletService.getWallet(this.userId, this.currentYear, this.currentMonth).subscribe((data) => {
      this.wallets = Object.entries(data || {}).map(([id, item]: [string, any]) => ({
        id,
        tipo: item.tipo || 'Sin tipo',
        valor: Number(item.valor || 0),
      }));
    });
  }

  get selectedWalletBalance(): number {
    return this.wallets.find((w) => w.id === this.selectedWalletId)?.valor || 0;
  }

  loadPumps(): void {
    this.vehicleService.getFuelPumps(this.userId).subscribe((data) => {
      this.pumps = Object.entries(data || {}).map(([id, item]: [string, any]) => ({
        id,
        nombre: item.nombre || '',
        precioGalon: Number(item.precioGalon || 0),
      }));
    });
  }

  get selectedPumpPrice(): number {
    return this.pumps.find((p) => p.id === this.selectedPumpId)?.precioGalon || 0;
  }

  openPumpModal(): void {
    this.newPump = { nombre: '', precioGalon: 0 };
    this.isPumpModalOpen = true;
  }

  closePumpModal(): void { this.isPumpModalOpen = false; }

  addPump(): void {
    if (!this.newPump.nombre.trim() || this.newPump.precioGalon <= 0) {
      alert('Completá nombre y precio por galón válidos.');
      return;
    }
    this.vehicleService.addFuelPump(this.userId, this.newPump).subscribe(() => {
      this.closePumpModal();
      this.loadPumps();
    });
  }

  openPumpEditModal(id: string): void {
    const original = this.pumps.find((p) => p.id === id);
    if (!original) return;
    this.editedPump = { ...original };
    this.editedPumpId = id;
    this.isPumpEditModalOpen = true;
  }

  closePumpEditModal(): void { this.isPumpEditModalOpen = false; this.editedPumpId = null; }

  saveEditedPump(): void {
    if (!this.editedPumpId) return;
    this.vehicleService.updateFuelPump(this.userId, this.editedPumpId, this.editedPump).subscribe(() => {
      this.closePumpEditModal();
      this.loadPumps();
    });
  }

  openPumpDeleteModal(id: string): void { this.pumpToDeleteId = id; this.isPumpDeleteModalOpen = true; }
  closePumpDeleteModal(): void { this.pumpToDeleteId = null; this.isPumpDeleteModalOpen = false; }

  confirmDeletePump(): void {
    if (!this.pumpToDeleteId) return;
    this.vehicleService.deleteFuelPump(this.userId, this.pumpToDeleteId).subscribe(() => {
      this.closePumpDeleteModal();
      this.loadPumps();
    });
  }

  openEditModal(id: string): void {
    const original = this.entries.find((e) => e.id === id);
    if (!original) return;
    this.editedEntry = { ...original };
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal(): void { this.isEditModalOpen = false; this.editedId = null; }

  saveEditedEntry(): void {
    if (!this.editedId) return;
    this.vehicleService.updateFuelEntry(this.userId, this.currentYear, this.currentMonth, this.editedId, this.editedEntry).subscribe(() => {
      this.closeEditModal();
      this.reloadAndSync();
    });
  }

  openDeleteModal(id: string): void { this.entryToDeleteId = id; this.isDeleteModalOpen = true; }
  closeDeleteModal(): void { this.entryToDeleteId = null; this.isDeleteModalOpen = false; }

  confirmDelete(): void {
    if (!this.entryToDeleteId) return;
    this.vehicleService.deleteFuelEntry(this.userId, this.currentYear, this.currentMonth, this.entryToDeleteId).subscribe(() => {
      this.closeDeleteModal();
      this.reloadAndSync();
    });
  }

  getPricePerGallon(entry: FuelEntryWithId): number {
    if (entry.precioGalon && entry.precioGalon > 0) return entry.precioGalon;
    return entry.galones > 0 ? entry.monto / entry.galones : 0;
  }

  getDistanceFromPrevious(index: number): number {
    if (index === 0) return 0;
    return Math.max(0, this.entries[index].kilometraje - this.entries[index - 1].kilometraje);
  }

  getDaysFromPrevious(index: number): number {
    if (index === 0) return 0;
    const current = new Date(this.entries[index].fecha).getTime();
    const prev = new Date(this.entries[index - 1].fecha).getTime();
    const diff = Math.round((current - prev) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  getKmPerGallon(index: number): number {
    const distance = this.getDistanceFromPrevious(index);
    const gallons = this.entries[index]?.galones || 0;
    return gallons > 0 ? distance / gallons : 0;
  }

  formatCurrency(v: number): string { return this.decimalPipe.transform(v, '1.0-0') || ''; }
  formatNumber(v: number): string { return this.decimalPipe.transform(v, '1.1-2') || ''; }
  formatCurrencyInput(v: number): string { return v ? this.formatCurrency(v) : ''; }
  formatNumberInput(v: number): string { return v ? this.formatNumber(v) : ''; }

  onMoneyInput(event: Event, field: 'newMonto' | 'editMonto' | 'pumpNew' | 'pumpEdit'): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d]/g, '');
    const value = Number(raw) || 0;

    if (field === 'newMonto') this.newEntry.monto = value;
    if (field === 'editMonto') this.editedEntry.monto = value;
    if (field === 'pumpNew') this.newPump.precioGalon = value;
    if (field === 'pumpEdit') this.editedPump.precioGalon = value;

    input.value = value ? this.formatCurrency(value) : '';
  }

  onDistanceInput(event: Event, field: 'newKm' | 'editKm'): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d]/g, '');
    const value = Number(raw) || 0;
    if (field === 'newKm') this.newEntry.kilometraje = value;
    if (field === 'editKm') this.editedEntry.kilometraje = value;
    input.value = value ? this.formatCurrency(value) : '';
  }

  onGallonsInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
    const value = Number(raw) || 0;
    this.editedEntry.galones = value;
    input.value = value ? this.formatNumber(value) : '';
  }

  private reloadAndSync(): void {
    this.vehicleService.getFuelEntries(this.userId, this.currentYear, this.currentMonth).subscribe((data) => {
      this.entries = Object.entries(data || {})
        .map(([id, item]: [string, any]) => ({ id, ...item }))
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      this.refreshChart();
      const total = this.entries.reduce((sum, e) => sum + (e.monto || 0), 0);
      this.syncGasolinaExpense(total);
    });
  }

  private syncGasolinaExpense(total: number): void {
    this.vehicleService.getGasolinaExpenseId(this.userId, this.currentYear, this.currentMonth).subscribe((existingId) => {
      if (total <= 0) {
        if (existingId) {
          this.expenseService.deleteExpense(this.userId, this.currentYear, this.currentMonth, existingId).subscribe();
          this.vehicleService.clearGasolinaExpenseId(this.userId, this.currentYear, this.currentMonth).subscribe();
        }
        return;
      }
      const expense = new Expense('Gasolina', 'Transporte', total, 0);
      if (existingId) {
        this.expenseService.updateExpense(this.userId, this.currentYear, this.currentMonth, existingId, expense).subscribe();
      } else {
        this.expenseService.addExpense(this.userId, this.currentYear, this.currentMonth, expense).subscribe((res) => {
          const newId = res?.name;
          if (newId) {
            this.vehicleService.setGasolinaExpenseId(this.userId, this.currentYear, this.currentMonth, newId).subscribe();
          }
        });
      }
    });
  }

  private refreshChart(): void {
    if (!this.vehicleChartRef?.nativeElement) return;
    const labels = this.entries.map((e, i) => `${i + 1}`);
    const kmPerGallonSeries = this.entries.map((_, i) => this.getKmPerGallon(i));

    const isDark = this.themeService.isDarkMode();
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.25)';

    this.chart?.destroy();
    this.chart = new Chart(this.vehicleChartRef.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Kilometraje x galón', data: kmPerGallonSeries, borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.2)', tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } },
        },
      },
    });
  }
}
