import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoanService } from '../../services/loans.service';
import { Loan } from '../../models/loans.model';
import { DateService } from '../../services/date.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FinanzasService } from '../../services/finanzas.service';
import { WalletService } from '../../services/wallet.service';
import { MatIconModule } from '@angular/material/icon';

export interface LoanWithId extends Loan {
  id: string;
}

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './loans.component.html',
  styleUrls: ['./loans.component.css'],
  providers: [DecimalPipe],
})
export default class LoansComponent implements OnInit, OnDestroy {
  // Servicios
  private loanService = inject(LoanService);
  private decimalPipe = inject(DecimalPipe);
  private dateService = inject(DateService);
  private authService = inject(AuthService);
  private walletService = inject(WalletService);
  private finanzasService = inject(FinanzasService);

  // Variables para modales de agregar valor y eliminar
  isAddValueModalOpen: boolean = false;
  isDeleteModalOpen: boolean = false;
  selectedLoanId: string | null = null;
  loanToDeleteId: string | null = null;
  newValue: number = 0;
  selectedWallet: string = '';

  // Modal de pago
  isPaymentModalOpen = false;
  loanToPay: LoanWithId | null = null;
  selectedPaymentWallet: string = '';

  // Datos
  incomes: any[] = [];
  expenses: any[] = [];
  wallet: any[] = [];
  loans: LoanWithId[] = [];

  estadoFinanciero: string = 'Cargando...';
  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';
  cuadreDescuadre = 0;

  // Modales
  isModalOpen = false;
  isEditModalOpen = false;

  // Edición
  editedLoan: Loan = new Loan('', '', '', 0, 'Pendiente');
  editedId: string | null = null;

  // Préstamo nuevo (modal)
  newLoan: Loan = new Loan('', '', '', 0, 'Pendiente');

  readonly userId = JSON.parse(localStorage.getItem('user') || '{}').localId;

  currentYear: string = '';
  currentMonth: string = '';
  private dateSubscription: Subscription | undefined;

  // Referencia a Math para usar en el template
  ngOnInit() {
    // ✅ Suscripción reactiva a año/mes
    this.dateSubscription = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
        this.loadLoans();
        this.loadWallets();
      }
    });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.userId,
      this.currentYear,
      this.currentMonth
    );
  }

  // Método de ciclo de vida para limpiar la suscripción al destruir el componente
  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  // Método para cargar los préstamos y calcular el estado financiero
  loadLoans() {
    this.loanService
      .getLoans(this.userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data) => {
          this.loans = Object.entries(data).map(([id, loan]) => ({
            id,
            ...loan,
          }));

          const today = new Date().toISOString().split('T')[0];

          for (const loan of this.loans) {
            if (loan.estado === 'Pendiente') {
              // ✅ Préstamo vencido
              if (new Date(loan.fecha_pago) < new Date(today)) {
                this.authService
                  .addNotification(
                    this.userId,
                    `Venció el préstamo a ${loan.deudor}`,
                    `prestamo_vencido_${loan.id}`
                  )
                  .subscribe();
              }

              // ✅ Recordatorio de cobro (solo una vez por día)
              this.authService
                .addNotification(
                  this.userId,
                  `Recordá que ${loan.deudor} te debe $${loan.valor}`,
                  `recordatorio_prestamo_${loan.id}`
                )
                .subscribe();
            }
          }
        },
        error: (err) => {
          console.error('Error al cargar préstamos:', err);
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
  // Modal: Agregar Préstamo
  // ======================
  openModal() {
    this.isModalOpen = true;
    this.newLoan = new Loan('', '', '', 0, 'Pendiente');
    this.selectedWallet = '';

    // ✅ cargar billeteras si aún no están cargadas
    if (!this.wallet.length) {
      this.loadWallets();
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.newLoan = new Loan('', '', '', 0, 'Pendiente');
    this.selectedWallet = '';
  }

  addLoan() {
    // Validaciones básicas
    if (
      !this.newLoan.deudor ||
      !this.newLoan.fecha_prestamo ||
      !this.newLoan.fecha_pago ||
      this.newLoan.valor <= 0
    ) {
      alert('Por favor completa todos los campos.');
      return;
    }

    // Validar que se seleccionó billetera
    if (!this.selectedWallet) {
      alert('Selecciona la billetera de origen.');
      return;
    }

    // Obtener billetera de origen
    const sourceWallet = this.wallet.find((a) => a.id === this.selectedWallet);
    if (!sourceWallet) {
      alert('Billetera seleccionada no encontrada.');
      return;
    }

    // Validar que haya suficiente saldo
    if (this.newLoan.valor > sourceWallet.valor) {
      alert('El valor excede el saldo disponible de la billetera.');
      return;
    }

    // 1️⃣ Crear el préstamo en backend
    this.loanService
      .addLoan(this.userId, this.currentYear, this.currentMonth, this.newLoan)
      .subscribe({
        next: () => {
          // 2️⃣ Actualizar billetera de origen descontando valor
          const updatedWallet = {
            tipo: sourceWallet.tipo,
            valor: sourceWallet.valor - this.newLoan.valor,
          };

          this.walletService
            .updateAccount(
              this.userId,
              this.currentYear,
              this.currentMonth,
              sourceWallet.id,
              updatedWallet
            )
            .subscribe({
              next: () => {
                this.loadLoans(); // recarga préstamos y billeteras
                this.closeModal(); // cierra modal y limpia formulario
                this.selectedWallet = ''; // limpiar selección
              },
              error: (err: any) =>
                console.error('Error al actualizar billetera:', err),
            });
        },
        error: (err: any) => console.error('Error al agregar préstamo:', err),
      });
  }

  loadWallets() {
    this.walletService
      .getWallet(this.userId, this.currentYear, this.currentMonth)
      .subscribe((data) => {
        this.wallet = Object.entries(data || {}).map(([id, w]) => ({
          id,
          tipo: w.tipo || 'Sin tipo', // mostrar tipo de billetera
          valor: w.valor || 0,
        }));
      });
  }

  // Devuelve el saldo de la billetera seleccionada
  get selectedWalletSaldo(): number {
    const account = this.wallet.find((w) => w.id === this.selectedWallet);
    return account ? account.valor : 0;
  }

  // ======================
  // Modal: Agregar Valor en Préstamo
  // ======================
  openAddModal(id: string) {
    this.selectedLoanId = id;
    this.isAddValueModalOpen = true;
  }

  closeAddValueModal() {
    this.isAddValueModalOpen = false;
    this.newValue = 0;
  }

  applyValue(action: 'add' | 'subtract') {
    if (!this.selectedLoanId) return;

    const loan = this.loans.find((l) => l.id === this.selectedLoanId);
    if (!loan) return;

    let finalValue = this.newValue;

    if (action === 'subtract') {
      finalValue = -Math.abs(this.newValue);
    } else {
      finalValue = Math.abs(this.newValue);
    }

    const updatedValue = loan.valor + finalValue;

    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: updatedValue,
      estado: loan.estado,
    };

    this.loanService
      .updateLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        loan.id,
        updatedLoan
      )
      .subscribe({
        next: () => {
          this.loadLoans();
          this.closeAddValueModal();
        },
        error: (err) => {
          console.error('Error al actualizar préstamo:', err);
        },
      });
  }

  // ======================
  // Modal: Pagado el Préstamo
  // ======================
  openPaymentModal(loan: LoanWithId) {
    if (loan.estado === 'Pagado') return; // solo prestamos pendientes
    this.loanToPay = loan;
    this.selectedPaymentWallet = '';
    this.isPaymentModalOpen = true;

    // Cargar billeteras si no están cargadas
    if (!this.wallet.length) {
      this.loadWallets();
    }
  }

  closePaymentModal() {
    this.isPaymentModalOpen = false;
    this.loanToPay = null;
    this.selectedPaymentWallet = '';
  }

  confirmLoanPayment() {
    if (!this.loanToPay) return;
    if (!this.selectedPaymentWallet) {
      alert('Selecciona la billetera para registrar el pago.');
      return;
    }

    const wallet = this.wallet.find((w) => w.id === this.selectedPaymentWallet);
    if (!wallet) {
      alert('Billetera no encontrada.');
      return;
    }

    // 1️⃣ Sumar el valor del préstamo a la billetera
    const updatedWallet = {
      tipo: wallet.tipo,
      valor: wallet.valor + this.loanToPay.valor,
    };

    this.walletService
      .updateAccount(
        this.userId,
        this.currentYear,
        this.currentMonth,
        wallet.id,
        updatedWallet
      )
      .subscribe({
        next: () => {
          // 2️⃣ Cambiar estado del préstamo a Pagado
          const updatedLoan: Loan = {
            ...this.loanToPay!,
            estado: 'Pagado',
          };
          this.loanService
            .updateLoan(
              this.userId,
              this.currentYear,
              this.currentMonth,
              this.loanToPay!.id,
              updatedLoan
            )
            .subscribe({
              next: () => {
                this.loadLoans(); // recarga la tabla
                this.loadWallets(); // actualiza billeteras
                this.isPaymentModalOpen = false;
                this.loanToPay = null;
                this.selectedPaymentWallet = '';
              },
              error: (err) =>
                console.error('Error al actualizar préstamo:', err),
            });
        },
        error: (err) => console.error('Error al actualizar billetera:', err),
      });
  }

  // ======================
  // Modal: Editar Préstamo
  // ======================
  openEditModal(id: string) {
    const original = this.loans.find((l) => l.id === id);
    if (!original) return;

    this.editedLoan = new Loan(
      original.deudor,
      original.fecha_prestamo,
      original.fecha_pago,
      original.valor,
      original.estado
    );
    this.editedId = id;
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editedLoan = new Loan('', '', '', 0, 'Pendiente');
    this.editedId = null;
  }

  saveEditedLoan() {
    if (!this.editedId) return;

    this.loanService
      .updateLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.editedId,
        this.editedLoan
      )
      .subscribe({
        next: () => {
          this.loadLoans();
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al actualizar préstamo:', err);
        },
      });
  }

  // ======================
  // Modal: Eliminar Préstamo
  // ======================
  openDeleteModal(id: string) {
    this.isDeleteModalOpen = true;
    this.loanToDeleteId = id;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.loanToDeleteId = null;
  }

  confirmDeleteLoan() {
    if (!this.loanToDeleteId) return;

    this.loanService
      .deleteLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        this.loanToDeleteId
      )
      .subscribe({
        next: () => {
          this.loadLoans();
          this.closeDeleteModal();
        },
        error: (err) => {
          console.error('Error al eliminar préstamo:', err);
        },
      });
  }

  // Método para cambiar el estado de un préstamo
  togglePaymentStatus(loan: LoanWithId) {
    const updatedStatus = (
      loan.estado === 'Pendiente' ? 'Pagado' : 'Pendiente'
    ) as 'Pendiente' | 'Pagado';

    const updatedLoan: Loan = {
      deudor: loan.deudor,
      fecha_prestamo: loan.fecha_prestamo,
      fecha_pago: loan.fecha_pago,
      valor: loan.valor,
      estado: updatedStatus,
    };

    this.loanService
      .updateLoan(
        this.userId,
        this.currentYear,
        this.currentMonth,
        loan.id,
        updatedLoan
      )
      .subscribe({
        next: () => {
          this.loadLoans();
        },
        error: (err) => {
          console.error('Error al actualizar estado del préstamo:', err);
        },
      });
  }

  // Método para calcular el total de préstamos pendientes
  getTotalPendingLoans(): number {
    return this.loans
      .filter((loan) => loan.estado === 'Pendiente')
      .reduce((sum, loan) => sum + Number(loan.valor), 0);
  }

  // Método para calcular el total de préstamos pagados
  formatCurrency(value: number): string {
    return this.decimalPipe.transform(value, '1.0-0') || '';
  }

  onValueInput(event: Event, type: 'new' | 'edit' | 'add') {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;

    if (type === 'new') {
      this.newLoan.valor = value;
    } else if (type === 'edit') {
      this.editedLoan.valor = value;
    } else if (type === 'add') {
      this.newValue = value;
    }

    input.value = this.formatCurrency(value);
  }
  onEditValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^\d-]/g, '');
    const value = Number(raw) || 0;
    this.editedLoan.valor = value;
    input.value = this.formatCurrency(value);
  }

  // loans.component.ts (o el componente donde tienes la tabla)
  getRowAnimationDelay(loan: any, index?: number): string {
    // Si pasas el index desde *ngFor, úsalo directamente
    const i = index ?? this.loans.indexOf(loan);
    // Retorna un delay incremental: 0.1s, 0.2s, 0.3s, ...
    return `${0.1 + i * 0.05}s`;
  }

  get paymentWalletSaldo(): number {
    if (!this.selectedPaymentWallet) return 0;
    const account = this.wallet.find(
      (w) => w.id === this.selectedPaymentWallet
    );
    return account ? account.valor : 0;
  }
}
