import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { InvoiceService } from '../../services/invoice.service';
import { ExpenseService } from '../../services/expense.service';
import { WalletAccount } from '../../models/wallet.model';
import { Invoice } from '../../models/invoice.model';
import { FinanzasService } from '../../services/finanzas.service';
import { Expense, CategoriaGasto } from '../../models/expense.model';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { FinancialStatusBadgeComponent } from '../../shared/components/financial-status-badge/financial-status-badge.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu?: boolean;
}

export interface InvoiceWithId extends Invoice {
  id: string;
  showMenu: boolean;
  gastoId?: string; // Para vincular al gasto si se paga
}

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, FinancialStatusBadgeComponent, ModalShellComponent, ConfirmModalComponent],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css'],
  providers: [DecimalPipe],
})
export default class InvoiceComponent implements OnInit, OnDestroy {
  private invoiceService = inject(InvoiceService);
  private walletService = inject(WalletService);
  private expenseService = inject(ExpenseService);
  private decimalPipe = inject(DecimalPipe);
  private finanzasService = inject(FinanzasService);
  private dateService = inject(DateService);

  today: Date = new Date();

  invoices: InvoiceWithId[] = [];
  wallet: WalletAccountWithId[] = [];

  // Estado financiero
  estadoFinanciero: string = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';

  // Modales
  isAddInvoiceModalOpen = false;
  isEditInvoiceModalOpen = false;
  isDeleteInvoiceModalOpen = false;
  isPayInvoiceModalOpen = false;

  newInvoice: Invoice = {
    nombre: '',
    fechaPago: '',
    valor: 0,
    estado: 'Pendiente',
  };

  editedInvoice: Invoice = {
    nombre: '',
    fechaPago: '',
    valor: 0,
    estado: 'Pendiente',
  };

  editedInvoiceId: string | null = null;
  invoiceToDeleteId: string | null = null;
  payInvoice: InvoiceWithId | null = null;
  selectedWalletForPayment: string = '';

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;
  currentYear = '';
  currentMonth = '';
  private dateSubscription: Subscription | undefined;

  ngOnInit() {
    this.today = new Date();
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadAllData();
      }
    });

    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  ngOnDestroy() {
    this.dateSubscription?.unsubscribe();
  }

  // ======================
  // Cargar datos
  // ======================
  loadAllData() {
    // Facturas
    this.invoiceService
      .getInvoices(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.invoices = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item, showMenu: false })
          );
          // Actualizar estado automáticamente
          this.invoices.forEach((inv) => {
            if (inv.estado === 'Pagada') return;
            const fechaPago = new Date(inv.fechaPago);
            inv.estado =
              inv.valor > 0 && fechaPago < this.today ? 'Vencida' : 'Pendiente';
          });
        },
      });

    // Billeteras
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.wallet = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item, showMenu: false })
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

  // ======================
  // Helpers UI
  // ======================
  toggleMenu(invoice: InvoiceWithId) {
    this.invoices.forEach((i) => (i.showMenu = false));
    invoice.showMenu = !invoice.showMenu;
  }

  getAnimationDelay(invoice: InvoiceWithId) {
    const index = this.invoices.indexOf(invoice);
    return `${0.3 + index * 0.1}s`;
  }

  formatCurrency(value: number) {
    return this.decimalPipe.transform(value, '1.0-0') || '0';
  }

  onValueInput(event: Event, type: 'new' | 'edit') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    if (type === 'new') this.newInvoice.valor = value;
    else this.editedInvoice.valor = value;
    input.value = this.formatCurrency(value);
  }

  // ======================
  // Estado de facturas
  // ======================
  isInvoiceOverdue(invoice: InvoiceWithId): boolean {
    return invoice.estado === 'Vencida';
  }

  isInvoicePaid(invoice: InvoiceWithId): boolean {
    return invoice.estado === 'Pagada';
  }

  isInvoicePending(invoice: InvoiceWithId): boolean {
    return invoice.estado === 'Pendiente';
  }

  canPayInvoice(invoice: InvoiceWithId): boolean {
    return invoice.estado !== 'Pagada';
  }

  getWalletBalance(walletId: string): number {
    const account = this.wallet.find((w) => w.id === walletId);
    return account ? account.valor : 0;
  }

  // ======================
  // Modal agregar factura
  // ======================
  openAddInvoiceModal() {
    this.isAddInvoiceModalOpen = true;
  }

  closeAddInvoiceModal() {
    this.isAddInvoiceModalOpen = false;
    this.newInvoice = {
      nombre: '',
      fechaPago: '',
      valor: 0,
      estado: 'Pendiente',
    };
  }

  addInvoice() {
    if (!this.newInvoice.nombre || !this.newInvoice.fechaPago) {
      alert('Completa todos los campos');
      return;
    }

    // Establecer estado inicial según la fecha
    const today = new Date();
    const fechaPago = new Date(this.newInvoice.fechaPago);

    const invoiceToSend: Invoice = {
      ...this.newInvoice,
      estado: fechaPago < today ? 'Vencida' : 'Pendiente',
    };

    this.invoiceService
      .addInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        invoiceToSend
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeAddInvoiceModal();
        },
        error: (err) => console.error('[POST] Error al agregar factura:', err),
      });
  }

  // ======================
  // Modal editar factura
  // ======================
  openEditInvoiceModal(id: string) {
    const invoice = this.invoices.find((i) => i.id === id);
    if (!invoice) return;
    this.editedInvoice = { ...invoice };
    this.editedInvoiceId = id;
    this.isEditInvoiceModalOpen = true;
  }

  closeEditInvoiceModal() {
    this.isEditInvoiceModalOpen = false;
    this.editedInvoiceId = null;
  }

  saveEditedInvoice() {
    if (!this.editedInvoiceId) return;

    // Recalcular estado según la nueva fecha
    const today = new Date();
    const fechaPago = new Date(this.editedInvoice.fechaPago);

    const invoiceToUpdate: Invoice = {
      ...this.editedInvoice,
      estado: fechaPago < today ? 'Vencida' : 'Pendiente',
    };

    this.invoiceService
      .updateInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedInvoiceId,
        invoiceToUpdate
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeEditInvoiceModal();
        },
        error: (err) => console.error('[PUT] Error al editar factura:', err),
      });
  }

  // ======================
  // Modal eliminar factura
  // ======================
  openDeleteInvoiceModal(id: string) {
    this.invoiceToDeleteId = id;
    this.isDeleteInvoiceModalOpen = true;
  }

  closeDeleteInvoiceModal() {
    this.isDeleteInvoiceModalOpen = false;
    this.invoiceToDeleteId = null;
  }

  confirmDeleteInvoice() {
    if (!this.invoiceToDeleteId) return;
    const invoice = this.invoices.find((i) => i.id === this.invoiceToDeleteId);
    if (!invoice) return;

    // 1️⃣ Obtener todos los gastos del mes
    this.expenseService
      .getExpenses(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (expenses: { [key: string]: Expense }) => {
          // 2️⃣ Filtrar gastos que coincidan con la factura
          const gastosCoincidentes = Object.entries(expenses || {}).filter(
            ([id, gasto]) =>
              gasto.categoria === CategoriaGasto.Facturas &&
              gasto.descripcion === invoice.nombre &&
              gasto.valor === invoice.valor
          );

          // 3️⃣ Eliminar todos los gastos coincidentes
          const deleteObservables = gastosCoincidentes.map(([id]) =>
            this.expenseService.deleteExpense(
              this.userId,
              this.currentYear,
              this.currentMonth,
              id
            )
          );

          // 4️⃣ Esperar a que se eliminen los gastos, luego eliminar la factura
          Promise.all(deleteObservables.map((obs) => obs.toPromise()))
            .then(() => {
              this.deleteInvoiceById(invoice.id);
            })
            .catch((err) =>
              console.error('[DELETE] Error al eliminar gastos asociados:', err)
            );
        },
        error: (err) => console.error('[GET] Error al obtener gastos:', err),
      });
  }

  // Función auxiliar para eliminar la factura
  private deleteInvoiceById(invoiceId: string) {
    this.invoiceService
      .deleteInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        invoiceId
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeDeleteInvoiceModal();
        },
        error: (err) =>
          console.error('[DELETE] Error al eliminar factura:', err),
      });
  }

  // ======================
  // Modal pagar factura
  // ======================
  openPayInvoiceModal(id: string) {
    const invoice = this.invoices.find((i) => i.id === id);
    if (!invoice) return;
    this.payInvoice = invoice;
    this.selectedWalletForPayment = '';
    this.isPayInvoiceModalOpen = true;
  }

  closePayInvoiceModal() {
    this.isPayInvoiceModalOpen = false;
    this.payInvoice = null;
  }

  confirmPayInvoice() {
    if (!this.payInvoice || !this.selectedWalletForPayment) return;

    const account = this.wallet.find(
      (w) => w.id === this.selectedWalletForPayment
    );
    if (!account) return;

    if (account.valor < this.payInvoice.valor) {
      alert('Saldo insuficiente');
      return;
    }

    // 1️⃣ Restar de la cartera
    account.valor -= this.payInvoice.valor;
    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        account.id,
        account
      )
      .subscribe();

    // 2️⃣ Registrar gasto
    const facturaGasto: Expense = new Expense(
      this.payInvoice.nombre,
      CategoriaGasto.Facturas,
      this.payInvoice.valor,
      this.payInvoice.valor
    );

    this.expenseService
      .addExpense(
        this.userId,
        this.currentYear,
        this.currentMonth,
        facturaGasto
      )
      .subscribe({
        next: (res: any) => {
          // Asociar id del gasto a la factura
          this.payInvoice!.gastoId = res.name || res.id;

          // 3️⃣ Cambiar estado a Pagada
          this.payInvoice!.estado = 'Pagada';

          // 4️⃣ Enviar cambio al backend
          this.invoiceService
            .updateInvoice(
              this.userId,
              this.currentYear,
              this.currentMonth,
              this.payInvoice!.id,
              this.payInvoice!
            )
            .subscribe({
              next: () => {
                // 5️⃣ Cerrar modal y recargar datos
                this.closePayInvoiceModal();
                this.loadAllData();
              },
              error: (err) =>
                console.error('[PUT] Error al actualizar factura pagada:', err),
            });
        },
      });
  }

  // ======================
  // Ordenar facturas: vencidas primero, pendientes, pagadas al final
  // ======================
  getTotalUnpaid(): number {
    return this.invoices
      .filter(i => i.estado !== 'Pagada')
      .reduce((sum, i) => sum + Number(i.valor), 0);
  }

  getUnpaidCount(): number {
    return this.invoices.filter(i => i.estado !== 'Pagada').length;
  }

  getTotalInvoices(): number {
    return this.invoices.reduce((sum, i) => sum + Number(i.valor), 0);
  }

  getSortedInvoices(): InvoiceWithId[] {
    return this.invoices.slice().sort((a, b) => {
      const aPagada = a.estado === 'Pagada';
      const bPagada = b.estado === 'Pagada';

      // Facturas pagadas al final
      if (!aPagada && bPagada) return -1;
      if (aPagada && !bPagada) return 1;

      const today = new Date();
      const aVencida =
        a.estado === 'Pendiente' && new Date(a.fechaPago) < today;
      const bVencida =
        b.estado === 'Pendiente' && new Date(b.fechaPago) < today;

      // Facturas vencidas al inicio
      if (aVencida && !bVencida) return -1;
      if (!aVencida && bVencida) return 1;

      // Orden por fecha
      return new Date(a.fechaPago).getTime() - new Date(b.fechaPago).getTime();
    });
  }
}
