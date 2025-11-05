import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet.service';
import { InvoiceService } from '../../services/invoice.service';
import { WalletAccount } from '../../models/wallet.model';
import { Invoice } from '../../models/invoice.model';
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
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);

  invoices: InvoiceWithId[] = [];
  wallet: WalletAccountWithId[] = [];

  // Modal agregar
  isAddInvoiceModalOpen = false;
  newInvoice: Invoice = { nombre: '', fechaPago: '', valor: 0 };

  // Modal editar
  isEditInvoiceModalOpen = false;
  editedInvoice: Invoice = { nombre: '', fechaPago: '', valor: 0 };
  editedInvoiceId: string | null = null;

  // Modal eliminar
  isDeleteInvoiceModalOpen = false;
  invoiceToDeleteId: string | null = null;

  // Modal pagar
  isPayInvoiceModalOpen = false;
  payInvoice: InvoiceWithId | null = null;
  selectedWalletForPayment: string = '';

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;
  currentYear = '';
  currentMonth = '';
  private dateSubscription: Subscription | undefined;

  ngOnInit() {
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadAllData();
      }
    });
  }

  ngOnDestroy() {
    this.dateSubscription?.unsubscribe();
  }

  loadAllData() {
    // Facturas
    this.invoiceService
      .getInvoices(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.invoices = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item, showMenu: false })
          );
        },
      });

    // Wallet
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.wallet = Object.entries(data || {}).map(
            ([id, item]: [string, any]) => ({ id, ...item, showMenu: false })
          );
        },
      });
  }

  // ======================
  // Modal Agregar Factura
  // ======================
  openAddInvoiceModal() {
    this.isAddInvoiceModalOpen = true;
  }
  closeAddInvoiceModal() {
    this.isAddInvoiceModalOpen = false;
    this.newInvoice = { nombre: '', fechaPago: '', valor: 0 };
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
      });
  }

  // ======================
  // Modal Editar Factura
  // ======================
  openEditInvoiceModal(id: string) {
    const invoice = this.invoices.find((i) => i.id === id);
    if (!invoice) return;
    this.editedInvoice = {
      nombre: invoice.nombre,
      fechaPago: invoice.fechaPago,
      valor: invoice.valor,
    };
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
      });
  }

  // ======================
  // Modal Eliminar Factura
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
    this.invoiceService
      .deleteInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.invoiceToDeleteId
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closeDeleteInvoiceModal();
        },
      });
  }

  // ======================
  // Modal Pagar Factura
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

  getWalletBalance(walletId: string) {
    const account = this.wallet.find((w) => w.id === walletId);
    return account ? account.valor : 0;
  }

  confirmPayInvoice() {
    if (!this.payInvoice || !this.selectedWalletForPayment) {
      alert('Selecciona una billetera');
      return;
    }

    const account = this.wallet.find(
      (w) => w.id === this.selectedWalletForPayment
    );
    if (!account) return;

    if (account.valor < this.payInvoice.valor) {
      alert('Saldo insuficiente');
      return;
    }

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

    this.payInvoice.valor = 0;
    this.invoiceService
      .updateInvoice(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.payInvoice.id,
        this.payInvoice
      )
      .subscribe({
        next: () => {
          this.loadAllData();
          this.closePayInvoiceModal();
        },
      });
  }

  // ======================
  // Helpers
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
}
