import {Component,OnInit,OnDestroy,Inject,PLATFORM_ID,} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import { WalletService } from '../../services/wallet.service';
import { DebtService } from '../../services/debts.service';
import { LoanService } from '../../services/loans.service';
import { DateService } from '../../services/date.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeService } from '../../services/income.service';

import { WalletAccount } from '../../models/wallet.model';
import { Debt } from '../../models/debt.model';
import { Loan } from '../../models/loans.model';
import { CategoriaGasto, Expense } from '../../models/expense.model';
import { Income } from '../../models/income.model';
import { FinanzasService } from '../../services/finanzas.service';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export default class HomeComponent implements OnInit, OnDestroy {
  // Subscripción
  private dateSubscription: Subscription | undefined;
  private authService = inject(AuthService);

  // Modal
  isModalDeudaOpen = false;
  isModalCuentaOpen = false;
  isModalPrestamoOpen = false;
  isModalGastoOpen = false;

  // Modal de gasto
  nuevaCuenta: WalletAccount = new WalletAccount('', 0);
  nuevoGasto: Expense = new Expense('', CategoriaGasto.Comida, 0, 0);
  nuevaDeuda: Debt = new Debt('', '', '', 0, 'Pendiente');
  nuevoPrestamo: Loan = new Loan('', '', '', 0, 'Pendiente');

  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';

  // Datos
  wallet: WalletAccount[] = [];
  debts: Debt[] = [];
  loans: Loan[] = [];
  gastos: Expense[] = [];
  ingresos: Income[] = [];

  // Fecha
  currentYear: string = '';
  currentMonth: string = '';

  // Estado financiero
  saludFinanciera: 'positiva' | 'advertencia' | 'critica' = 'positiva';
  mensajeSaludFinanciera: string = '';

  // Para modal de gasto desde home
  categorias = Object.values(CategoriaGasto); // Llena el select con enum

  // Nuevas métricas
  cuadreDescuadre: number = 0;
  estadoFinanciero: string = '';
  estimacionGastosMes: number = 0;
  estimacionDineroRestanteMes: number = 0;
  gastadoActualmente: number = 0;
  restanteActualmente: number = 0;
  restanteTotal: number = 0;
  diferenciaSaldo: number = 0;

  constructor(
    private walletService: WalletService,
    private debtService: DebtService,
    private loanService: LoanService,
    private expenseService: ExpenseService,
    private incomeService: IncomeService,
    private dateService: DateService,
    public router: Router,
    private finanzasService: FinanzasService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.dateSubscription = this.dateService.selectedDate$.subscribe(
      ({ year, month }: { year: string; month: string }) => {
        if (year && month) {
          this.currentYear = year;
          this.currentMonth = month;
          this.loadData();
        }
      }
    );

    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.currentUser,
      this.currentYear,
      this.currentMonth
    );
    this.authService.startAutoLogout();
  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
  }

  // Cargar datos
  loadData() {
    const userId = this.currentUser;
    if (!userId) return;
    forkJoin({
      wallet: this.walletService.getWallet(
        userId,
        this.currentYear,
        this.currentMonth
      ),
      debts: this.debtService.getDebts(
        userId,
        this.currentYear,
        this.currentMonth
      ),
      loans: this.loanService.getLoans(
        userId,
        this.currentYear,
        this.currentMonth
      ),
      expenses: this.expenseService.getExpenses(
        userId,
        this.currentYear,
        this.currentMonth
      ),
      incomes: this.incomeService.getIncomes(
        userId,
        this.currentYear,
        this.currentMonth
      ),
    }).subscribe(({ wallet, debts, loans, expenses, incomes }) => {
      this.wallet = Object.entries(wallet || {}).map(
        ([id, item]: [string, any]) => ({ id, ...item })
      );
      this.debts = Object.entries(debts || {}).map(
        ([id, item]: [string, any]) => ({ id, ...item })
      );
      this.loans = Object.entries(loans || {}).map(
        ([id, item]: [string, any]) => ({ id, ...item })
      );
      this.gastos = Object.entries(expenses || {}).map(
        ([id, item]: [string, any]) => ({ id, ...item })
      );
      this.ingresos = Object.entries(incomes || {}).map(
        ([id, item]: [string, any]) => ({ id, ...item })
      );
      this.evaluarSaludFinanciera();
    });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.currentUser,
      this.currentYear,
      this.currentMonth
    );
  }

  // Usuario actual
  get currentUser(): string {
    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.localId || '';
    }
    return '';
  }

  // Totales
  get totalWallet(): number {
    return this.wallet.reduce((sum, w) => sum + (w.valor || 0), 0);
  }

  // get totalDebts(): number {
  get totalPendingDebts(): number {
    return this.debts
      .filter((d) => d.estado === 'Pendiente')
      .reduce((sum, d) => sum + (d.valor || 0), 0);
  }

  // get totalPendingExpenses(): number {
  get totalPendingLoans(): number {
    return this.loans
      .filter((l) => l.estado === 'Pendiente')
      .reduce((sum, l) => sum + (l.valor || 0), 0);
  }

  // Evaluar salud financiera usando ingresos totales en lugar de cartera
  evaluarSaludFinanciera() {
    const ingresoTotalMes = this.ingresos.reduce(
      (acc, i) => acc + (i.valor || 0),
      0
    );

    const deudasPendientes = this.debts.filter((d) => d.estado === 'Pendiente');
    const totalDeudasPendientes = deudasPendientes.reduce(
      (sum, d) => sum + (d.valor || 0),
      0
    );

    const estimacionesGastosMes = this.gastos.reduce(
      (acc, g) => acc + (g.estimacion || 0),
      0
    );

    const totalCompromisos = totalDeudasPendientes + estimacionesGastosMes;

    if (ingresoTotalMes > totalCompromisos) {
      this.saludFinanciera = 'positiva';
      this.mensajeSaludFinanciera = 'Finanzas saludables';
    } else if (ingresoTotalMes === totalCompromisos) {
      this.saludFinanciera = 'advertencia';
      this.mensajeSaludFinanciera = 'Presupuesto justo';
    } else {
      this.saludFinanciera = 'critica';
      this.mensajeSaludFinanciera =
        '¡Alerta! Tienes más compromisos que ingresos disponibles';
    }
  }

  // Nombre del mes
  nombreMes(m: string): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const index = parseInt(m) - 1;
    return meses[index] || '';
  }

  // Acción del botón flotante
  irAgregarRapido() {
    this.router.navigate(['/app/expense']);
  }

  // Abrir modal de gasto
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  abrirModalCuenta() {
    this.isModalCuentaOpen = true;
    this.nuevaCuenta = new WalletAccount('', 0);
  }

  cerrarModalCuenta() {
    this.isModalCuentaOpen = false;
  }

  guardarCuentaDesdeHome() {
    if (!this.nuevaCuenta.tipo || this.nuevaCuenta.valor <= 0) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.walletService
      .addAccount(
        this.currentUser,
        this.currentYear,
        this.currentMonth,
        this.nuevaCuenta
      )
      .subscribe({
        next: () => {
          this.loadData(); // Actualiza vista
          this.cerrarModalCuenta(); // Cierra modal
        },
        error: (err) => {
          console.error('❌ Error al agregar cuenta desde home:', err);
        },
      });
  }

  // Abrir modal de deuda
  abrirModalDeuda() {
    this.isModalDeudaOpen = true;
    this.nuevaDeuda = new Debt('', '', '', 0, 'Pendiente');
  }

  cerrarModalDeuda() {
    this.isModalDeudaOpen = false;
  }

  guardarDeudaDesdeHome() {
    if (
      !this.nuevaDeuda.acreedor ||
      !this.nuevaDeuda.fecha_deuda ||
      !this.nuevaDeuda.fecha_pago ||
      this.nuevaDeuda.valor <= 0
    ) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.debtService
      .addDebt(
        this.currentUser,
        this.currentYear,
        this.currentMonth,
        this.nuevaDeuda
      )
      .subscribe({
        next: () => {
          this.loadData();
          this.cerrarModalDeuda();
        },
        error: (err) => {
          console.error('❌ Error al agregar deuda desde home:', err);
        },
      });
  }

  // Abrir modal de préstamo
  abrirModalPrestamo() {
    this.isModalPrestamoOpen = true;
    this.nuevoPrestamo = new Loan('', '', '', 0, 'Pendiente');
  }

  cerrarModalPrestamo() {
    this.isModalPrestamoOpen = false;
  }

  guardarPrestamoDesdeHome() {
    if (
      !this.nuevoPrestamo.deudor ||
      !this.nuevoPrestamo.fecha_prestamo ||
      !this.nuevoPrestamo.fecha_pago ||
      this.nuevoPrestamo.valor <= 0
    ) {
      alert('Por favor completa todos los campos.');
      return;
    }

    this.loanService
      .addLoan(
        this.currentUser,
        this.currentYear,
        this.currentMonth,
        this.nuevoPrestamo
      )
      .subscribe({
        next: () => {
          this.loadData();
          this.cerrarModalPrestamo();
        },
        error: (err) => {
          console.error('❌ Error al agregar préstamo desde home:', err);
        },
      });
  }

  // Abrir modal de gasto
  formatearInputMoneda(event: Event, tipo: 'cuenta' | 'deuda' | 'prestamo') {
    const input = event.target as HTMLInputElement;

    // Elimina todo lo que no sean números
    const raw = input.value.replace(/\D/g, '');
    const valorNumerico = Number(raw);

    const valorFormateado = valorNumerico.toLocaleString('es-CO');

    input.value = valorNumerico ? valorFormateado : '';

    if (tipo === 'cuenta') {
      this.nuevaCuenta.valor = valorNumerico;
    } else if (tipo === 'deuda') {
      this.nuevaDeuda.valor = valorNumerico;
    } else if (tipo === 'prestamo') {
      this.nuevoPrestamo.valor = valorNumerico;
    }
  }
}
