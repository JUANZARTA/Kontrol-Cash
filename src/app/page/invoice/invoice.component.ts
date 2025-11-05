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
  imports: [CommonModule, FormsModule, MatIconModule],
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
    this.invoiceService
      .addInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.newInvoice
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
    this.invoiceService
      .updateInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedInvoiceId,
        this.editedInvoice
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

    if (invoice.gastoId) {
      // Si existe gasto asociado, eliminar primero
      this.expenseService
        .deleteExpense(
          this.userId,
          this.currentYear,
          this.currentMonth,
          invoice.gastoId
        )
        .subscribe({
          next: () => {
            // Luego eliminar factura
            this.deleteInvoiceById(invoice.id);
          },
          error: (err) =>
            console.error('[DELETE] Error al eliminar gasto asociado:', err),
        });
    } else {
      // Si no tiene gasto, eliminar factura directamente
      this.deleteInvoiceById(invoice.id);
    }
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

    // Restar de la cartera
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

    // Registrar gasto
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
          this.payInvoice!.estado = 'Pagada';
          this.closePayInvoiceModal();
          this.loadAllData();
        },
      });
  }

  // ======================
  // Ordenar facturas: vencidas primero, pendientes, pagadas al final
  // ======================
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
