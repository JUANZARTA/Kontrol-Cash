import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { DateService } from '../../services/date.service';
import { VehicleService } from '../../services/vehicle.service';
import { FuelEntry, FuelEntryWithId, FuelPump, FuelPumpWithId } from '../../models/vehicle.model';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { ThemeService } from '../../services/theme.service';
import { WalletService } from '../../services/wallet.service';
import { ExpenseService } from '../../services/expense.service';
import { Expense, ExpenseWithId } from '../../models/expense.model';
import { LongPressDirective } from '../../shared/directives/long-press.directive';

Chart.register(...registerables);

type ChartType = 'rendimiento' | 'dias' | 'kmGalon' | 'costoKm' | 'acumulado';

@Component({
  selector: 'app-vehicle',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, ConfirmModalComponent, LongPressDirective],
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
  allEntries: FuelEntryWithId[] = [];
  private allEntriesLoaded = false;
  pumps: FuelPumpWithId[] = [];
  wallets: Array<{ id: string; tipo: string; valor: number }> = [];
  selectedPumpId = '';
  selectedWalletId = '';
  newEntry: FuelEntry = { nombreBomba: '', monto: 0, galones: 0, kilometraje: 0, fecha: '' };
  editedEntry: FuelEntry = { nombreBomba: '', monto: 0, galones: 0, kilometraje: 0, fecha: '' };
  editedId: string | null = null;
  entryToDeleteId: string | null = null;
  selectedIds = new Set<string>();
  showBulkDeleteConfirm = false;
  selectionMode = false;

  isAddModalOpen = false;
  isEditModalOpen = false;
  isDeleteModalOpen = false;
  isPumpModalOpen = false;
  isPumpEditModalOpen = false;
  isPumpDeleteModalOpen = false;
  isEstimacionModalOpen = false;

  gasolinaEstimacion = 0;
  newEstimacion = 0;
  vehicleExpenses: ExpenseWithId[] = [];
  vehicleExpenseSummary: { descripcion: string; total: number }[] = [];
  isVehicleExpModalOpen = false;
  isVehicleExpEditModalOpen = false;
  isVehicleExpDeleteModalOpen = false;
  newVehicleExp: { descripcion: string; valor: number; estimacion: number } = { descripcion: '', valor: 0, estimacion: 0 };
  editedVehicleExp: ExpenseWithId | null = null;
  vehicleExpToDeleteId: string | null = null;
  selectedWalletForVehicleExp = '';

  isVehicleExpAddValModalOpen = false;
  vehicleExpAddValTarget: ExpenseWithId | null = null;
  vehicleExpAddVal = 0;
  selectedWalletForVehicleExpAdd = '';

  chartType: ChartType = 'rendimiento';
  showChartMenu = false;

  readonly chartOptions: { key: ChartType; label: string; icon: string }[] = [
    { key: 'rendimiento', label: 'Rendimiento por tanqueo', icon: 'local_gas_station' },
    { key: 'dias',        label: 'Rendimiento por día',     icon: 'calendar_today' },
    { key: 'kmGalon',    label: 'KM por galón',             icon: 'speed' },
    { key: 'costoKm',    label: 'Costo por KM',             icon: 'payments' },
    { key: 'acumulado',  label: 'Gasto acumulado',          icon: 'stacked_line_chart' },
  ];

  selectChartType(type: ChartType): void {
    this.chartType = type;
    this.showChartMenu = false;
    this.refreshChart();
  }

  get currentChartLabel(): string {
    return this.chartOptions.find(o => o.key === this.chartType)?.label ?? '';
  }
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
        if (!this.allEntriesLoaded) {
          this.allEntriesLoaded = true;
          this.loadAllEntriesForChart();
        }
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
    });
    this.loadGasolinaAndVehicleExpenses();
  }

  loadAllEntriesForChart(): void {
    this.vehicleService.getAllRecentFuelEntries(this.userId, this.currentYear, this.currentMonth).subscribe(entries => {
      this.allEntries = entries;
      this.refreshChart();
    });
  }

  loadGasolinaAndVehicleExpenses(): void {
    this.expenseService.getExpenses(this.userId, this.currentYear, this.currentMonth).subscribe((data: any) => {
      const all: ExpenseWithId[] = Object.entries(data || {}).map(([eid, item]: [string, any]) => ({ id: eid, ...item }));
      const gasolina = all.find(e => e.categoria === 'Vehículo' && e.descripcion === 'Gasolina');
      this.gasolinaEstimacion = gasolina?.estimacion || 0;
      this.vehicleExpenses = all.filter(e => e.categoria === 'Vehículo' && e.descripcion !== 'Gasolina');
      const map = new Map<string, number>();
      for (const exp of this.vehicleExpenses) {
        map.set(exp.descripcion, (map.get(exp.descripcion) || 0) + exp.valor);
      }
      this.vehicleExpenseSummary = Array.from(map.entries()).map(([descripcion, total]) => ({ descripcion, total }));

      if (this.gasolinaEstimacion === 0) {
        this.carryOverEstimacion();
      }
    });
  }

  private getPreviousMonth(): { year: string; month: string } {
    let m = parseInt(this.currentMonth, 10) - 1;
    let y = parseInt(this.currentYear, 10);
    if (m === 0) { m = 12; y--; }
    return { year: String(y), month: String(m).padStart(2, '0') };
  }

  private carryOverEstimacion(): void {
    const prev = this.getPreviousMonth();
    this.expenseService.getExpenses(this.userId, prev.year, prev.month).subscribe((data: any) => {
      const all: ExpenseWithId[] = Object.entries(data || {}).map(([eid, item]: [string, any]) => ({ id: eid, ...item }));
      const prevGasolina = all.find(e => e.categoria === 'Vehículo' && e.descripcion === 'Gasolina');
      if (!prevGasolina?.estimacion || prevGasolina.estimacion <= 0) return;

      this.gasolinaEstimacion = prevGasolina.estimacion;
      const expense = new Expense('Gasolina', 'Vehículo', 0, this.gasolinaEstimacion);
      this.expenseService.addExpense(this.userId, this.currentYear, this.currentMonth, expense).subscribe((res: any) => {
        const newId = res?.name;
        if (newId) {
          this.vehicleService.setGasolinaExpenseId(this.userId, this.currentYear, this.currentMonth, newId).subscribe();
        }
      });
    });
  }

  get vehicleExpTotal(): number {
    return this.vehicleExpenses.reduce((sum, e) => sum + e.valor, 0);
  }

  get vehicleExpEstimacionTotal(): number {
    return this.vehicleExpenses.reduce((sum, e) => sum + (e.estimacion || 0), 0);
  }

  getWalletBalance(id: string): number {
    return this.wallets.find(w => w.id === id)?.valor || 0;
  }

  openVehicleExpModal(): void {
    this.newVehicleExp = { descripcion: '', valor: 0, estimacion: 0 };
    this.selectedWalletForVehicleExp = '';
    this.isVehicleExpModalOpen = true;
  }

  closeVehicleExpModal(): void { this.isVehicleExpModalOpen = false; }

  addVehicleExpense(): void {
    if (!this.newVehicleExp.descripcion.trim() || this.newVehicleExp.valor <= 0) {
      alert('Completá descripción y valor.');
      return;
    }
    const expense = new Expense(this.newVehicleExp.descripcion, 'Vehículo', this.newVehicleExp.valor, this.newVehicleExp.estimacion);
    this.expenseService.addExpense(this.userId, this.currentYear, this.currentMonth, expense).subscribe(() => {
      if (this.selectedWalletForVehicleExp) {
        const wallet = this.wallets.find(w => w.id === this.selectedWalletForVehicleExp);
        if (wallet && wallet.valor >= this.newVehicleExp.valor) {
          const updated = { tipo: wallet.tipo, valor: wallet.valor - this.newVehicleExp.valor };
          this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, wallet.id, updated).subscribe(() => this.loadWallets());
        }
      }
      this.closeVehicleExpModal();
      this.loadGasolinaAndVehicleExpenses();
    });
  }

  openVehicleExpAddValModal(id: string): void {
    const found = this.vehicleExpenses.find(e => e.id === id);
    if (!found) return;
    this.vehicleExpAddValTarget = { ...found };
    this.vehicleExpAddVal = 0;
    this.selectedWalletForVehicleExpAdd = '';
    this.isVehicleExpAddValModalOpen = true;
  }

  closeVehicleExpAddValModal(): void {
    this.isVehicleExpAddValModalOpen = false;
    this.vehicleExpAddValTarget = null;
  }

  applyVehicleExpValue(action: 'add' | 'subtract'): void {
    if (!this.vehicleExpAddValTarget || this.vehicleExpAddVal <= 0) return;
    const exp = this.vehicleExpAddValTarget;
    const newValor = action === 'add'
      ? exp.valor + this.vehicleExpAddVal
      : Math.max(0, exp.valor - this.vehicleExpAddVal);

    const updated = new Expense(exp.descripcion, exp.categoria, newValor, exp.estimacion);
    this.expenseService.updateExpense(this.userId, this.currentYear, this.currentMonth, exp.id, updated).subscribe(() => {
      if (this.selectedWalletForVehicleExpAdd) {
        const wallet = this.wallets.find(w => w.id === this.selectedWalletForVehicleExpAdd);
        if (wallet) {
          const delta = action === 'add' ? -this.vehicleExpAddVal : this.vehicleExpAddVal;
          const updatedWallet = { tipo: wallet.tipo, valor: wallet.valor + delta };
          this.walletService.updateAccount(this.userId, this.currentYear, this.currentMonth, wallet.id, updatedWallet).subscribe(() => this.loadWallets());
        }
      }
      this.closeVehicleExpAddValModal();
      this.loadGasolinaAndVehicleExpenses();
    });
  }

  openVehicleExpEditModal(id: string): void {
    const found = this.vehicleExpenses.find(e => e.id === id);
    if (!found) return;
    this.editedVehicleExp = { ...found };
    this.isVehicleExpEditModalOpen = true;
  }

  closeVehicleExpEditModal(): void { this.isVehicleExpEditModalOpen = false; this.editedVehicleExp = null; }

  saveVehicleExpense(): void {
    if (!this.editedVehicleExp) return;
    const { id, ...data } = this.editedVehicleExp;
    this.expenseService.updateExpense(this.userId, this.currentYear, this.currentMonth, id, data as Expense).subscribe(() => {
      this.closeVehicleExpEditModal();
      this.loadGasolinaAndVehicleExpenses();
    });
  }

  openVehicleExpDeleteModal(id: string): void { this.vehicleExpToDeleteId = id; this.isVehicleExpDeleteModalOpen = true; }
  closeVehicleExpDeleteModal(): void { this.vehicleExpToDeleteId = null; this.isVehicleExpDeleteModalOpen = false; }

  confirmDeleteVehicleExp(): void {
    if (!this.vehicleExpToDeleteId) return;
    this.expenseService.deleteExpense(this.userId, this.currentYear, this.currentMonth, this.vehicleExpToDeleteId).subscribe(() => {
      this.closeVehicleExpDeleteModal();
      this.loadGasolinaAndVehicleExpenses();
    });
  }

  openEstimacionModal(): void {
    this.newEstimacion = this.gasolinaEstimacion;
    this.isEstimacionModalOpen = true;
  }

  closeEstimacionModal(): void { this.isEstimacionModalOpen = false; }

  saveEstimacion(): void {
    if (this.newEstimacion <= 0) return;
    this.gasolinaEstimacion = this.newEstimacion;

    this.vehicleService.getGasolinaExpenseId(this.userId, this.currentYear, this.currentMonth).subscribe(existingId => {
      if (existingId) {
        // Actualiza solo la estimación del gasto existente
        const total = this.entries.reduce((sum, e) => sum + (e.monto || 0), 0);
        const expense = new Expense('Gasolina', 'Vehículo',total, this.gasolinaEstimacion);
        this.expenseService.updateExpense(this.userId, this.currentYear, this.currentMonth, existingId, expense).subscribe();
      } else {
        // Crea el gasto con valor=0 y la estimación definida
        const expense = new Expense('Gasolina', 'Vehículo',0, this.gasolinaEstimacion);
        this.expenseService.addExpense(this.userId, this.currentYear, this.currentMonth, expense).subscribe((res: any) => {
          const newId = res?.name;
          if (newId) {
            this.vehicleService.setGasolinaExpenseId(this.userId, this.currentYear, this.currentMonth, newId).subscribe();
          }
        });
      }
    });

    this.closeEstimacionModal();
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
  get allSelected(): boolean { return this.entries.length > 0 && this.entries.every(e => this.selectedIds.has(e.id)); }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleSelectAll(): void {
    if (this.allSelected) this.selectedIds.clear();
    else this.entries.forEach(e => this.selectedIds.add(e.id));
  }

  confirmBulkDelete(): void {
    const ids = Array.from(this.selectedIds);
    const ops = ids.map(id => this.vehicleService.deleteFuelEntry(this.userId, this.currentYear, this.currentMonth, id));
    forkJoin(ops).subscribe(() => {
      this.selectedIds.clear();
      this.showBulkDeleteConfirm = false;
      this.reloadAndSync();
    });
  }

  getPricePerGallon(entry: FuelEntryWithId): number {
    if (entry.precioGalon && entry.precioGalon > 0) return entry.precioGalon;
    return entry.galones > 0 ? entry.monto / entry.galones : 0;
  }

  private getPrevEntryForFirst(): FuelEntryWithId | null {
    if (this.entries.length === 0 || this.allEntries.length === 0) return null;
    const firstId = this.entries[0].id;
    const allIdx = this.allEntries.findIndex(e => e.id === firstId);
    return allIdx > 0 ? this.allEntries[allIdx - 1] : null;
  }

  getDistanceFromPrevious(index: number): number {
    if (index === 0) {
      const prev = this.getPrevEntryForFirst();
      return prev ? Math.max(0, this.entries[0].kilometraje - prev.kilometraje) : 0;
    }
    return Math.max(0, this.entries[index].kilometraje - this.entries[index - 1].kilometraje);
  }

  getDaysFromPrevious(index: number): number {
    if (index === 0) {
      const prev = this.getPrevEntryForFirst();
      if (!prev) return 0;
      const diff = new Date(this.entries[0].fecha).getTime() - new Date(prev.fecha).getTime();
      return Math.max(0, Math.round(diff / 86400000));
    }
    const current = new Date(this.entries[index].fecha).getTime();
    const prev = new Date(this.entries[index - 1].fecha).getTime();
    return Math.max(0, Math.round((current - prev) / 86400000));
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

  onMoneyInput(event: Event, field: 'newMonto' | 'editMonto' | 'pumpNew' | 'pumpEdit' | 'estimacion' | 'vehicleExpNew' | 'vehicleExpEstimacion' | 'vehicleExpEdit' | 'vehicleExpEditEstimacion' | 'vehicleExpAddVal'): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d]/g, '');
    const value = Number(raw) || 0;

    if (field === 'newMonto') this.newEntry.monto = value;
    if (field === 'editMonto') this.editedEntry.monto = value;
    if (field === 'pumpNew') this.newPump.precioGalon = value;
    if (field === 'pumpEdit') this.editedPump.precioGalon = value;
    if (field === 'estimacion') this.newEstimacion = value;
    if (field === 'vehicleExpNew') this.newVehicleExp.valor = value;
    if (field === 'vehicleExpEstimacion') this.newVehicleExp.estimacion = value;
    if (field === 'vehicleExpEdit' && this.editedVehicleExp) this.editedVehicleExp.valor = value;
    if (field === 'vehicleExpEditEstimacion' && this.editedVehicleExp) this.editedVehicleExp.estimacion = value;
    if (field === 'vehicleExpAddVal') this.vehicleExpAddVal = value;

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
      const total = this.entries.reduce((sum, e) => sum + (e.monto || 0), 0);
      this.syncGasolinaExpense(total);
    });
    this.loadAllEntriesForChart();
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
      const expense = new Expense('Gasolina', 'Vehículo',total, this.gasolinaEstimacion);
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

    const isDark = this.themeService.isDarkMode();
    const textColor = isDark ? '#cbd5e1' : '#334155';
    const gridColor = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.25)';

    const src = this.allEntries;

    if (src.length === 0) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    let labels = src.map(e => {
      const d = new Date(e.fecha);
      return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
    });

    const getDist = (i: number) =>
      i === 0 ? 0 : Math.max(0, src[i].kilometraje - src[i - 1].kilometraje);

    const getDays = (i: number) => {
      if (i === 0) return 0;
      const diff = new Date(src[i].fecha).getTime() - new Date(src[i - 1].fecha).getTime();
      return Math.max(0, Math.round(diff / 86400000));
    };

    const getKmG = (i: number) => {
      const km = getDist(i);
      const g = src[i]?.galones || 0;
      return g > 0 ? Math.round((km / g) * 10) / 10 : 0;
    };

    let datasets: any[] = [];
    let yAxisTitle = '';

    switch (this.chartType) {
      case 'rendimiento': {
        datasets = [{
          label: 'KM recorridos',
          data: src.map((_, i) => getDist(i)),
          borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.15)', tension: 0.3, fill: true,
        }];
        yAxisTitle = 'Kilómetros';
        break;
      }
      case 'dias': {
        datasets = [{
          label: 'KM por día',
          data: src.map((_, i) => {
            const days = getDays(i);
            return days > 0 ? Math.round((getDist(i) / days) * 10) / 10 : 0;
          }),
          borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)', tension: 0.3, fill: true,
        }];
        yAxisTitle = 'KM / día';
        break;
      }
      case 'kmGalon': {
        datasets = [{
          label: 'KM por galón',
          data: src.map((_, i) => getKmG(i)),
          borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', tension: 0.3, fill: true,
        }];
        yAxisTitle = 'KM / galón';
        break;
      }
      case 'costoKm': {
        datasets = [{
          label: 'Costo por KM ($)',
          data: src.map((e, i) => {
            const km = getDist(i);
            return km > 0 ? Math.round((e.monto / km) * 10) / 10 : 0;
          }),
          borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)', tension: 0.3, fill: true,
        }];
        yAxisTitle = '$ / KM';
        break;
      }
      case 'acumulado': {
        let cumulative = 0;
        const monthEntries = this.entries;
        labels = monthEntries.map(e => {
          const d = new Date(e.fecha);
          return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
        });
        datasets = [{
          label: 'Gasto acumulado ($)',
          data: monthEntries.map(e => { cumulative += e.monto; return cumulative; }),
          borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)', tension: 0.3, fill: true,
        }];
        if (this.gasolinaEstimacion > 0) {
          datasets.push({
            label: 'Presupuesto mensual',
            data: monthEntries.map(() => this.gasolinaEstimacion),
            borderColor: '#f97316', borderDash: [6, 4], backgroundColor: 'transparent',
            tension: 0, fill: false, pointRadius: 0,
          });
        }
        yAxisTitle = '$ acumulados';
        break;
      }
    }

    this.chart?.destroy();
    this.chart = new Chart(this.vehicleChartRef.nativeElement, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor },
            title: { display: true, text: yAxisTitle, color: textColor },
          },
        },
      },
    });
  }
}
