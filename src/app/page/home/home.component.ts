import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';

import { WalletService } from '../../services/wallet.service';
import { DebtService } from '../../services/debts.service';
import { LoanService } from '../../services/loans.service';
import { DateService } from '../../services/date.service';
import { ExpenseService } from '../../services/expense.service';
import { IncomeService } from '../../services/income.service';
import { InvoiceService } from '../../services/invoice.service';
import { SavingsService } from '../../services/savings.service';
import { Invoice } from '../../models/invoice.model';

import { WalletAccount } from '../../models/wallet.model';
import { Debt } from '../../models/debt.model';

import { Loan } from '../../models/loans.model';
import { CategoriaGasto, Expense } from '../../models/expense.model';
import { Income, CategoriaIngreso } from '../../models/income.model';
import { FinanzasService } from '../../services/finanzas.service';
import { Saving } from '../../models/savings.model';
import { BarChartComponent } from '../../shared/components/bar-chart/bar-chart.component';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { inject } from '@angular/core';
import { FinancialChartComponent } from '../../shared/components/financial-chart/financial-chart.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';

interface DebtWithId extends Debt {
  id: string;
}

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu?: boolean;
}

export interface InvoiceWithId extends Invoice {
  id: string;
  showMenu: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
      FormsModule,
      FinancialChartComponent,
      BarChartComponent,
      ModalShellComponent,
  ],
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
  selectedYear: string = '';
  selectedMonth: string = '';

  // --- Modal de pago de facturas ---
  isPayInvoiceModalOpen: boolean = false;
  payInvoice: any = null;
  selectedWalletForPayment: string = '';

  // Modal de gasto
  nuevaCuenta: WalletAccount = new WalletAccount('', 0);
  nuevoGasto: Expense = new Expense('', CategoriaGasto.Comida, 0, 0);
  nuevaDeuda: Debt = new Debt('', '', '', 0, 'Pendiente');
  nuevoPrestamo: Loan = new Loan('', '', '', 0, 'Pendiente');

  estadoFinancieroColor: 'verde' | 'rojo' | 'azul' = 'verde';

  userId!: string;

  // Datos
  wallet: WalletAccountWithId[] = [];
  // debts: Debt[] = [];
  debts: DebtWithId[] = [];
  loans: Loan[] = [];
  gastos: Expense[] = [];
  ingresos: Income[] = [];
  invoices: InvoiceWithId[] = [];

  // Fecha
  currentYear: string = new Date().getFullYear().toString();
  currentMonth: string = (new Date().getMonth() + 1)
    .toString()
    .padStart(2, '0');

  // Estado financiero
  saludFinanciera: 'positiva' | 'advertencia' | 'critica' = 'positiva';
  mensajeSaludFinanciera: string = 'Cargando estado financiero...';

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

  // Totales para la gráfica redonda
  totalBilletera: number = 0;
  gastosTotales: number = 0;
  totalDeuda: number = 0;
  totalPrestamo: number = 0;
  ingresosTotales: number = 0;
  totalAhorro: number = 0;

  constructor(
    private walletService: WalletService,
    private debtService: DebtService,
    private loanService: LoanService,
    private expenseService: ExpenseService,
    private incomeService: IncomeService,
    private dateService: DateService,
    private invoiceService: InvoiceService,
    private savingsService: SavingsService,
    public router: Router,
    private finanzasService: FinanzasService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
    
    // Verificar si es el día 1 del mes y ejecutar copia automática
    this.verificarYCopiarMesAnteriorAutomatico();
    
    this.dateSubscription = this.dateService.selectedDate$.subscribe(
      ({ year, month }: { year: string; month: string }) => {
        if (year && month) {
          this.currentYear = year;
          this.currentMonth = month;
          this.loadData();
          // Verificar nuevamente cuando cambia la fecha
          this.verificarYCopiarMesAnteriorAutomatico();
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
    this.loadInvoices();
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
      this.calcularTotales();
      this.loadInvoices();
    });
    this.finanzasService.mostrarEstadoFinanciero(
      this,
      this.currentUser,
      this.currentYear,
      this.currentMonth
    );
  }

  private calcularTotales() {
    // 🔹 Usa los nombres reales de tus modelos
    this.totalDeuda = this.debts?.reduce((a, d) => a + (d.valor || 0), 0);
    this.totalPrestamo = this.loans?.reduce((a, p) => a + (p.valor || 0), 0);
    this.ingresosTotales = this.ingresos?.reduce(
      (a, i) => a + (i.valor || 0),
      0
    );
    this.gastosTotales = this.gastos?.reduce((a, g) => a + (g.valor || 0), 0);
    this.totalBilletera = this.wallet?.reduce((a, c) => a + (c.valor || 0), 0);

    // 🔹 Calcula total disponible aproximado
    this.restanteTotal =
      this.totalBilletera + this.totalPrestamo - this.totalDeuda;

    // 🔹 Si no hay ingresos explícitos, inferirlos
    if (!this.ingresosTotales && this.restanteTotal) {
      this.ingresosTotales = this.restanteTotal;
    }

    // 🔹 Calcula ahorro estimado
    this.totalAhorro =
      this.estimacionDineroRestanteMes ||
      Math.max(this.ingresosTotales - this.gastosTotales, 0);
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

  // Formatear moneda
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  // -----------------------------
  // Cargar deudas (loadDebts)
  // -----------------------------
  loadDebts(): void {
    const userId = this.currentUser; // usa tu getter currentUser
    if (!userId) {
      console.warn('loadDebts: no hay userId disponible');
      this.debts = [];
      return;
    }

    this.debtService
      .getDebts(userId, this.currentYear, this.currentMonth)
      .subscribe({
        next: (data: any) => {
          if (!data) {
            this.debts = [];
            return;
          }

          // data viene como { id1: {...}, id2: {...} }
          this.debts = Object.entries(data).map(([id, value]) => {
            return { id, ...(value as Debt) } as DebtWithId;
          });

          // debugging: ver lo que llegó
          console.debug('loadDebts -> deudas cargadas:', this.debts);

        },
        error: (err) => {
          console.error('Error al cargar deudas (loadDebts):', err);
          this.debts = [];
        },
      });
  }

  // -----------------------------
  // Obtener solo pendientes (getPendingDebts)
  // -----------------------------
  getPendingDebts(): DebtWithId[] {
    // aseguramos que devuelva objetos con id
    return this.debts.filter((d) => d.estado === 'Pendiente');
  }

  // -----------------------------
  // Cambiar estado (togglePaymentStatus)
  // -----------------------------
  togglePaymentStatus(debt: DebtWithId): void {
    if (!debt || !debt.id) {
      console.warn('togglePaymentStatus: deuda inválida', debt);
      return;
    }

    const userId = this.currentUser;
    if (!userId) {
      console.warn('togglePaymentStatus: no hay userId disponible');
      return;
    }

    const nuevoEstado: 'Pendiente' | 'Pagado' =
      debt.estado === 'Pendiente' ? 'Pagado' : 'Pendiente';

    const payload: Debt = {
      acreedor: debt.acreedor,
      fecha_deuda: debt.fecha_deuda,
      fecha_pago: debt.fecha_pago,
      valor: debt.valor,
      estado: nuevoEstado,
    };

    // actualizar optimísticamente
    const estadoAnterior = debt.estado;
    debt.estado = nuevoEstado;

    this.debtService
      .updateDebt(userId, this.currentYear, this.currentMonth, debt.id, payload)
      .subscribe({
        next: () => {
          this.loadDebts();
        },
        error: (err) => {
          console.error('Error al cambiar estado de la deuda:', err);
          // revertir UI
          debt.estado = estadoAnterior;
        },
      });
  }

  // -----------------------------
  // PAGAR FACTURA
  // -----------------------------
  openPayInvoiceModal(invoiceId: string) {
    this.payInvoice = this.invoices.find((i) => i.id === invoiceId) || null;
    this.selectedWalletForPayment = '';
    this.isPayInvoiceModalOpen = true;
  }

  closePayInvoiceModal() {
    this.isPayInvoiceModalOpen = false;
    this.payInvoice = null;
    this.selectedWalletForPayment = '';
  }

  // Obtener saldo REAL desde Wallet
  getWalletBalance(id: string) {
    const account = this.wallet.find((acc) => acc.id === id);
    return account ? account.valor : 0;
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
        this.currentUser,
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
        this.currentUser,
        this.currentYear,
        this.currentMonth,
        facturaGasto
      )
      .subscribe({
        next: (res: any) => {
          this.payInvoice!.gastoId = res.name || res.id;

          // 3️⃣ Marcar como pagada
          this.payInvoice!.estado = 'Pagada';

          // 4️⃣ Actualizar factura
          this.invoiceService
            .updateInvoice(
              this.currentUser,
              this.currentYear,
              this.currentMonth,
              this.payInvoice!.id,
              this.payInvoice!
            )
            .subscribe({
              next: () => {
                this.closePayInvoiceModal();
                this.loadData();
              },
              error: (err) =>
                console.error('[PUT] Error al actualizar factura pagada:', err),
            });
        },
      });
  }

  // Cargar facturas desde Firebase
  loadInvoices() {
    const userId = this.currentUser;
    const year = this.currentYear;
    const month = this.currentMonth;

    if (!userId || !year || !month) {
      this.invoices = [];
      return;
    }

    this.invoiceService
      .getInvoices(userId, year, month)
      .subscribe((res: any) => {
        if (!res) {
          this.invoices = [];
          return;
        }

        this.invoices = Object.entries(res).map(
          ([id, item]: [string, any]) => ({
            id,
            ...(item as Invoice),
            showMenu: false,
          })
        );
      });
  }

  // Ordenar facturas correctamente
  getSortedInvoices() {
    if (!this.invoices) return [];

    const hoy = new Date();

    return this.invoices
      .filter((inv) => inv.estado !== 'Pagada')
      .sort((a, b) => {
        const fechaA = new Date(a.fechaPago);
        const fechaB = new Date(b.fechaPago);

        // 1️⃣ Vencidas primero
        const vencidaA = fechaA < hoy;
        const vencidaB = fechaB < hoy;
        if (vencidaA && !vencidaB) return -1;
        if (!vencidaA && vencidaB) return 1;

        // 2️⃣ De más cercana a más lejana
        return fechaA.getTime() - fechaB.getTime();
      });
  }

  // Verificar y copiar mes anterior automáticamente si es día 1
  verificarYCopiarMesAnteriorAutomatico() {
    if (!isPlatformBrowser(this.platformId)) return;

    const userId = this.currentUser;
    if (!userId) return;

    const hoy = new Date();
    const diaActual = hoy.getDate();
    const mesActual = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const añoActual = hoy.getFullYear().toString();

    // Solo ejecutar si es el día 1 del mes
    if (diaActual !== 1) return;

    // Verificar si ya se ejecutó la copia para este mes
    const claveMesCopiado = `mesCopiado_${añoActual}_${mesActual}`;
    const yaCopiado = localStorage.getItem(claveMesCopiado);

    if (yaCopiado === 'true') return; // Ya se ejecutó para este mes

    // Verificar que el mes actual coincida con el seleccionado
    if (this.currentYear !== añoActual || this.currentMonth !== mesActual) {
      return; // Esperar a que el usuario esté viendo el mes actual
    }

    // Ejecutar copia automática sin confirmación
    // La marca de "copiado" se hará dentro de ejecutarCopiaMesAnterior cuando termine exitosamente
    this.ejecutarCopiaMesAnterior(false, claveMesCopiado);
  }

  // Copiar datos del mes anterior
  copiarMesAnterior() {
    if (!confirm('¿Estás seguro de copiar todos los datos del mes anterior?')) {
      return;
    }
    this.ejecutarCopiaMesAnterior(true);
  }

  // Ejecutar la copia del mes anterior (con o sin confirmación)
  ejecutarCopiaMesAnterior(mostrarMensaje: boolean = true, claveMesCopiado?: string) {
    const userId = this.currentUser;
    if (!userId) {
      if (mostrarMensaje) {
        alert('Error: No se pudo identificar el usuario');
      }
      return;
    }

    // Calcular mes anterior
    const currentDate = new Date(
      parseInt(this.currentYear),
      parseInt(this.currentMonth) - 1,
      1
    );
    currentDate.setMonth(currentDate.getMonth() - 1);
    const previousYear = currentDate.getFullYear().toString();
    const previousMonth = (currentDate.getMonth() + 1)
      .toString()
      .padStart(2, '0');

    // Primero, eliminar el ingreso "Mes anterior" existente si existe
    this.incomeService
      .getIncomes(userId, this.currentYear, this.currentMonth)
      .subscribe((currentIncomes) => {
        if (currentIncomes) {
          Object.entries(currentIncomes).forEach(([id, income]: [string, any]) => {
            if (income.nombre === 'Mes anterior') {
              this.incomeService
                .deleteIncome(userId, this.currentYear, this.currentMonth, id)
                .subscribe();
            }
          });
        }

        // Luego, obtener todos los datos del mes anterior
        this.obtenerYCopiarDatosMesAnterior(userId, previousYear, previousMonth, mostrarMensaje, claveMesCopiado);
      });
  }

  // Función auxiliar para obtener y copiar datos del mes anterior
  obtenerYCopiarDatosMesAnterior(
    userId: string,
    previousYear: string,
    previousMonth: string,
    mostrarMensaje: boolean,
    claveMesCopiado?: string
  ) {
    forkJoin({
      wallet: this.walletService.getWallet(
        userId,
        previousYear,
        previousMonth
      ),
      incomes: this.incomeService.getIncomes(
        userId,
        previousYear,
        previousMonth
      ),
      invoices: this.invoiceService.getInvoices(
        userId,
        previousYear,
        previousMonth
      ),
      expenses: this.expenseService.getExpenses(
        userId,
        previousYear,
        previousMonth
      ),
      savings: this.savingsService.getSavings(
        userId,
        previousYear,
        previousMonth
      ),
      debts: this.debtService.getDebts(userId, previousYear, previousMonth),
      loans: this.loanService.getLoans(userId, previousYear, previousMonth),
    }).subscribe({
      next: ({ wallet, incomes, invoices, expenses, savings, debts, loans }) => {
        // 0. Copiar billetera tal cual
        let totalBilletera = 0;
        if (wallet) {
          Object.entries(wallet).forEach(([id, account]: [string, any]) => {
            const nuevaCuenta = new WalletAccount(account.tipo, account.valor);
            totalBilletera += account.valor || 0;
            this.walletService
              .addAccount(
                userId,
                this.currentYear,
                this.currentMonth,
                nuevaCuenta
              )
              .subscribe();
          });
        }

        // 1. Copiar ingresos con valor en $0
        if (incomes) {
          Object.entries(incomes).forEach(([id, income]: [string, any]) => {
            const nuevoIngreso = new Income(
              income.nombre,
              income.categoria,
              0 // valor en $0
            );
            this.incomeService
              .addIncome(
                userId,
                this.currentYear,
                this.currentMonth,
                nuevoIngreso
              )
              .subscribe();
          });
        }

        // 1.5. Crear ingreso "Mes anterior" con el total de la billetera
        // (Ya se eliminó el anterior antes de llamar a esta función)
        if (totalBilletera > 0) {
          const ingresoMesAnterior = new Income(
            'Mes anterior',
            CategoriaIngreso.Fijo,
            totalBilletera
          );
          this.incomeService
            .addIncome(
              userId,
              this.currentYear,
              this.currentMonth,
              ingresoMesAnterior
            )
            .subscribe();
        }

        // 2. Copiar facturas con estado "Pendiente" y actualizar fecha (solo mes)
        if (invoices) {
          Object.entries(invoices).forEach(([id, invoice]: [string, any]) => {
            // Actualizar fecha: conservar día, cambiar mes al actual
            const fechaAnterior = new Date(invoice.fechaPago);
            let dia = fechaAnterior.getDate();
            
            // Asegurar que el día existe en el mes actual
            const mesActual = parseInt(this.currentMonth) - 1;
            const añoActual = parseInt(this.currentYear);
            const ultimoDiaDelMes = new Date(añoActual, mesActual + 1, 0).getDate();
            if (dia > ultimoDiaDelMes) {
              dia = ultimoDiaDelMes;
            }
            
            const nuevaFecha = new Date(añoActual, mesActual, dia);
            const fechaFormateada = nuevaFecha.toISOString().split('T')[0];

            const nuevaFactura: Invoice = {
              nombre: invoice.nombre,
              fechaPago: fechaFormateada,
              valor: invoice.valor,
              estado: 'Pendiente', // estado no pagado
            };

            this.invoiceService
              .addInvoice(
                userId,
                this.currentYear,
                this.currentMonth,
                nuevaFactura
              )
              .subscribe();
          });
        }

        // 3. Copiar gastos: valor en $0, conservar estimación, eliminar categoría "Facturas"
        if (expenses) {
          Object.entries(expenses).forEach(([id, expense]: [string, any]) => {
            // Eliminar gastos de categoría "Facturas"
            if (expense.categoria === CategoriaGasto.Facturas) {
              return; // No copiar este gasto
            }

            const nuevoGasto = new Expense(
              expense.descripcion,
              expense.categoria,
              0, // valor gastado en $0
              expense.estimacion // conservar estimación
            );

            this.expenseService
              .addExpense(
                userId,
                this.currentYear,
                this.currentMonth,
                nuevoGasto
              )
              .subscribe();
          });
        }

        // 4. Copiar ahorros tal cual
        if (savings) {
          Object.entries(savings).forEach(([id, saving]: [string, any]) => {
            const nuevoAhorro = new Saving(saving.tipo, saving.valor);
            this.savingsService
              .addSaving(
                userId,
                this.currentYear,
                this.currentMonth,
                nuevoAhorro
              )
              .subscribe();
          });
        }

        // 5. Copiar deudas tal cual
        if (debts) {
          Object.entries(debts).forEach(([id, debt]: [string, any]) => {
            const nuevaDeuda = new Debt(
              debt.acreedor,
              debt.fecha_deuda,
              debt.fecha_pago,
              debt.valor,
              debt.estado
            );
            this.debtService
              .addDebt(
                userId,
                this.currentYear,
                this.currentMonth,
                nuevaDeuda
              )
              .subscribe();
          });
        }

        // 6. Copiar préstamos (deudores): solo los que NO están pagados
        if (loans) {
          Object.entries(loans).forEach(([id, loan]: [string, any]) => {
            // Solo copiar si el estado es "Pendiente"
            if (loan.estado === 'Pendiente') {
              const nuevoPrestamo = new Loan(
                loan.deudor,
                loan.fecha_prestamo,
                loan.fecha_pago,
                loan.valor,
                loan.estado
              );
              this.loanService
                .addLoan(
                  userId,
                  this.currentYear,
                  this.currentMonth,
                  nuevoPrestamo
                )
                .subscribe();
            }
            // Si está pagado, no se copia (se elimina)
          });
        }

        // Recargar datos después de un breve delay
        setTimeout(() => {
          this.loadData();
          // Marcar como copiado si es ejecución automática
          if (claveMesCopiado) {
            localStorage.setItem(claveMesCopiado, 'true');
          }
          if (mostrarMensaje) {
            alert('Datos del mes anterior copiados exitosamente');
          }
        }, 1000);
      },
      error: (err) => {
        console.error('Error al copiar datos del mes anterior:', err);
        if (mostrarMensaje) {
          alert('Error al copiar los datos del mes anterior');
        }
      },
    });
  }
}
