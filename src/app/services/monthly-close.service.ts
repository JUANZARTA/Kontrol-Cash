import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, from, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import { AuthService } from './auth.service';
import { WalletService } from './wallet.service';
import { ExpenseService } from './expense.service';
import { IncomeService } from './income.service';
import { DebtService } from './debts.service';
import { LoanService } from './loans.service';
import { InvoiceService } from './invoice.service';
import { SavingsService } from './savings.service';
import { VehicleService } from './vehicle.service';
import { MonthlyCloseSnapshot } from '../models/monthly-close.model';
import { Income } from '../models/income.model';
import { CategoriaGasto, Expense } from '../models/expense.model';
import { Debt } from '../models/debt.model';
import { Loan } from '../models/loans.model';
import { Saving } from '../models/savings.model';
import { Invoice } from '../models/invoice.model';
import { FuelEntry } from '../models/vehicle.model';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable({ providedIn: 'root' })
export class MonthlyCloseService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private walletService = inject(WalletService);
  private expenseService = inject(ExpenseService);
  private incomeService = inject(IncomeService);
  private debtService = inject(DebtService);
  private loanService = inject(LoanService);
  private invoiceService = inject(InvoiceService);
  private savingsService = inject(SavingsService);
  private vehicleService = inject(VehicleService);
  private readonly DB = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  getNextPeriod(year: string, month: string): { year: string; month: string } {
    const m = parseInt(month);
    const y = parseInt(year);
    if (m === 12) return { year: String(y + 1), month: '01' };
    return { year, month: String(m + 1).padStart(2, '0') };
  }

  getPreviousPeriod(year: string, month: string): { year: string; month: string } {
    const m = parseInt(month);
    const y = parseInt(year);
    if (m === 1) return { year: String(y - 1), month: '12' };
    return { year, month: String(m - 1).padStart(2, '0') };
  }

  /**
   * Cierra `year`/`month` y transfiere los datos al mes siguiente. Es el único punto
   * de entrada real del cierre — tanto el botón manual como el chequeo automático
   * de `checkAndRunAutoClose` pasan por acá, para no repetir la lógica en dos lugares.
   */
  executeClose(userId: string, year: string, month: string): Observable<{ incomeTotal: number; expenseTotal: number; debtPending: number }> {
    const next = this.getNextPeriod(year, month);

    return forkJoin({
      wallets: this.walletService.getWallet(userId, year, month),
      expenses: this.expenseService.getExpenses(userId, year, month),
      incomes: this.incomeService.getIncomes(userId, year, month),
      debts: this.debtService.getDebts(userId, year, month),
      loans: this.loanService.getLoans(userId, year, month),
      invoices: this.invoiceService.getInvoices(userId, year, month),
      savings: this.savingsService.getSavings(userId, year, month),
      vehicleEntries: this.vehicleService.getFuelEntries(userId, year, month),
      mesAnteriorId: this.getMesAnteriorId(userId, next.year, next.month),
    }).pipe(
      switchMap(data => {
        const ops: any[] = [];

        // 1. Alcancías → pasan con saldo actual, sin movimientos del mes anterior
        Object.values(data.savings || {}).forEach(s => {
          ops.push(this.savingsService.addSaving(userId, next.year, next.month,
            new Saving(s.tipo, s.valor, s.nombre, s.metaAhorro)));
        });

        // 2. Deudas → solo pendientes, cuotas intactas
        Object.values(data.debts || {}).filter(d => d.estado === 'Pendiente').forEach(d => {
          ops.push(this.debtService.addDebt(userId, next.year, next.month,
            new Debt(d.acreedor, d.fecha_deuda, d.fecha_pago, d.valor, 'Pendiente',
              d.totalCuotas, d.cuotasPagadas)));
        });

        // 3. Deudores → solo pendientes, cuotas intactas
        Object.values(data.loans || {}).filter(l => l.estado === 'Pendiente').forEach(l => {
          ops.push(this.loanService.addLoan(userId, next.year, next.month,
            new Loan(l.deudor, l.fecha_prestamo, l.fecha_pago, l.valor, 'Pendiente',
              l.totalCuotas, l.cuotasPagadas)));
        });

        // 4. Facturas → todas en estado Pendiente, mismo día/año pero mes siguiente
        const advanceMonth = (dateStr: string, y: string, m: string): string => {
          if (!dateStr) return dateStr;
          const day = new Date(dateStr).getDate();
          const adjusted = new Date(parseInt(y), parseInt(m) - 1, day);
          return adjusted.toISOString().split('T')[0];
        };
        (Object.values(data.invoices || {}) as Invoice[]).forEach(inv => {
          ops.push(this.invoiceService.addInvoice(userId, next.year, next.month,
            { nombre: inv.nombre, fechaPago: advanceMonth(inv.fechaPago, next.year, next.month), valor: inv.valor, estado: 'Pendiente' }));
        });

        // 5. Gastos → solo categorías Fijo y Variable pasan (nombre + estimación, valor en $0).
        //    El resto (Comida, Facturas, Deuda, Vehículo, etc.) no se transfiere.
        Object.values(data.expenses || {}).filter(e => e.categoria === CategoriaGasto.Fijo || e.categoria === CategoriaGasto.Variable).forEach(exp => {
          ops.push(this.expenseService.addExpense(userId, next.year, next.month,
            new Expense(exp.descripcion, exp.categoria, 0, exp.estimacion)));
        });

        // 6. Ingresos fijos → pasan con valor en $0 ("Mes anterior" se maneja aparte en el paso 7)
        Object.values(data.incomes || {}).filter(i => i.nombre !== 'Mes anterior').forEach(inc => {
          ops.push(this.incomeService.addIncome(userId, next.year, next.month,
            new Income(inc.nombre, inc.categoria, 0)));
        });

        // 7. Ingreso "Mes anterior" → saldo real de billeteras del mes que cierra.
        //    Si ya existe (mesAnteriorId), se edita; nunca se crea un duplicado.
        const walletTotal = Object.values(data.wallets || {}).reduce((s, w) => s + (w.valor || 0), 0);
        const mesAnteriorIncome = new Income('Mes anterior', 'Otro', walletTotal);
        if (data.mesAnteriorId) {
          ops.push(this.incomeService.updateIncome(userId, next.year, next.month,
            data.mesAnteriorId, mesAnteriorIncome));
        } else {
          ops.push(
            this.incomeService.addIncome(userId, next.year, next.month, mesAnteriorIncome).pipe(
              switchMap((res: any) => {
                const newId = res?.name;
                return newId
                  ? this.setMesAnteriorId(userId, next.year, next.month, newId)
                  : of(null);
              })
            )
          );
        }

        // 8. Vehículo → se conserva el último tanqueo real como fila de referencia, opaca y no
        //    editable, sin participar de las estadísticas del mes siguiente. Los gastos manuales
        //    de vehículo no se transfieren (paso 5 ya los excluyó).
        const vehicleEntries = Object.values(data.vehicleEntries || {}) as FuelEntry[];
        const realEntries = vehicleEntries
          .filter(e => !e.esReferencia)
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        const referenceSource = realEntries[realEntries.length - 1] ?? vehicleEntries.find(e => e.esReferencia);
        if (referenceSource) {
          ops.push(this.vehicleService.addFuelEntry(userId, next.year, next.month, {
            nombreBomba: referenceSource.nombreBomba,
            bombaId: referenceSource.bombaId,
            precioGalon: referenceSource.precioGalon,
            monto: referenceSource.monto,
            galones: referenceSource.galones,
            kilometraje: referenceSource.kilometraje,
            fecha: referenceSource.fecha,
            esReferencia: true,
          }));
        }

        const expenseTotal = Object.values(data.expenses || {}).reduce((s, e) => s + (e.valor || 0), 0);
        const incomeTotal = Object.values(data.incomes || {}).reduce((s, i) => s + (i.valor || 0), 0);
        const debtPending = Object.values(data.debts || {})
          .filter(d => d.estado === 'Pendiente')
          .reduce((s, d) => s + (d.valor || 0), 0);

        // 9. Billetera → recién al final, cuando todo lo demás ya se transfirió, para que
        //    no quede ningún descuadre a mitad de camino.
        return forkJoin(ops.length ? ops : [of(null)]).pipe(
          switchMap(() => {
            const walletOps = Object.values(data.wallets || {}).map(w =>
              this.walletService.addAccount(userId, next.year, next.month, { tipo: w.tipo, valor: w.valor })
            );
            return forkJoin(walletOps.length ? walletOps : [of(null)]);
          }),
          switchMap(() => this.markMonthClosed(userId, year, month)),
          map(() => ({ incomeTotal, expenseTotal, debtPending }))
        );
      }),
      map(totals => {
        this.closeMonth(userId, {
          period: `${year}-${month}`,
          closedAt: new Date().toISOString(),
          totals: {
            income: totals.incomeTotal,
            expense: totals.expenseTotal,
            net: totals.incomeTotal - totals.expenseTotal,
            debtPending: totals.debtPending,
          },
          categories: {},
          pdf: { path: '', size: 0, sha256: '' },
        });
        return totals;
      })
    );
  }

  /**
   * Revisa si el mes calendario REAL anterior (no el mes que el usuario esté mirando en
   * la app) ya fue cerrado. Si no, lo cierra automáticamente y devuelve qué se cerró,
   * para que el que llama pueda mostrar una notificación. Pensado para llamarse UNA
   * sola vez por sesión desde un lugar único (el layout raíz de /app), nunca desde
   * páginas individuales — así no se repite el bug de doble ejecución que ya tuvimos.
   */
  checkAndRunAutoClose(userId: string): Observable<{ period: string; nextPeriod: string } | null> {
    if (!userId) return of(null);

    const now = new Date();
    const prev = this.getPreviousPeriod(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));

    return this.isMonthClosed(userId, prev.year, prev.month).pipe(
      switchMap(closed => {
        if (closed) return of(null);
        const next = this.getNextPeriod(prev.year, prev.month);
        return this.executeClose(userId, prev.year, prev.month).pipe(
          map(() => ({ period: `${prev.year}-${prev.month}`, nextPeriod: `${next.year}-${next.month}` }))
        );
      }),
      catchError(() => of(null))
    );
  }

  isMonthClosed(userId: string, year: string, month: string): Observable<boolean> {
    const base = `${this.DB}/${userId}/${year}/${month}/cierreMes.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<boolean | null>(url).pipe(
          map(v => v === true),
          catchError(() => of(false))
        );
      })
    );
  }

  markMonthClosed(userId: string, year: string, month: string): Observable<any> {
    const base = `${this.DB}/${userId}/${year}/${month}/cierreMes.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, true).pipe(catchError(() => of(null)));
      })
    );
  }

  reopenMonth(userId: string, year: string, month: string): Observable<any> {
    const base = `${this.DB}/${userId}/${year}/${month}/cierreMes.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, false).pipe(catchError(() => of(null)));
      })
    );
  }

  clearMonth(userId: string, year: string, month: string): Observable<any> {
    const base = `${this.DB}/${userId}/${year}/${month}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(catchError(() => of(null)));
      })
    );
  }

  getMesAnteriorId(userId: string, year: string, month: string): Observable<string | null> {
    const base = `${this.DB}/${userId}/${year}/${month}/mesAnteriorId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<string | null>(url).pipe(catchError(() => of(null)));
      })
    );
  }

  setMesAnteriorId(userId: string, year: string, month: string, id: string): Observable<any> {
    const base = `${this.DB}/${userId}/${year}/${month}/mesAnteriorId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, JSON.stringify(id)).pipe(catchError(() => of(null)));
      })
    );
  }

  // ── localStorage (snapshots de historial) ──────────────────────────────────

  list(uid: string): MonthlyCloseSnapshot[] {
    if (!uid) return [];
    const raw = localStorage.getItem(this.storageKey(uid));
    return this.safeParse(raw).sort((a, b) => b.period.localeCompare(a.period));
  }

  deleteSnapshot(uid: string, period: string): void {
    if (!uid || !period) return;
    const remaining = this.list(uid).filter(item => item.period !== period);
    localStorage.setItem(this.storageKey(uid), JSON.stringify(remaining));
  }

  closeMonth(uid: string, snapshot: MonthlyCloseSnapshot): void {
    if (!uid || !snapshot?.period) return;
    const all = this.list(uid);
    const idx = all.findIndex(item => item.period === snapshot.period);
    if (idx >= 0) {
      all[idx] = snapshot;
    } else {
      all.push(snapshot);
    }
    localStorage.setItem(this.storageKey(uid), JSON.stringify(all));
  }

  async downloadPdf(snapshot: MonthlyCloseSnapshot): Promise<void> {
    const safePeriod = this.sanitizeFilePart(snapshot?.period || 'periodo');
    const t = snapshot?.totals ?? { income: 0, expense: 0, net: 0, debtPending: 0 };

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;

    // Encabezado
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 32, 'F');

    try {
      const logo = await this.loadImageAsDataUrl('icons/icon-128x128.png');
      doc.addImage(logo, 'PNG', marginX, 6, 20, 20);
    } catch (error) {
      console.warn('No se pudo incluir el logo en el PDF de cierre:', error);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Kontrol Cash', marginX + 24, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Cierre de mes', marginX + 24, 23);

    // Periodo y fecha de cierre
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(this.formatPeriodLabel(snapshot?.period), marginX, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    const closedAtLabel = snapshot?.closedAt
      ? new Date(snapshot.closedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'N/A';
    doc.text(`Cerrado el ${closedAtLabel}`, marginX, 51);

    // Tabla de totales
    const rows: Array<{ label: string; value: number; color: [number, number, number] }> = [
      { label: 'Ingresos', value: t.income, color: [13, 148, 136] },
      { label: 'Gastos', value: t.expense, color: [234, 88, 12] },
      { label: 'Neto', value: t.net, color: t.net >= 0 ? [13, 148, 136] : [220, 38, 38] },
      { label: 'Deuda pendiente', value: t.debtPending, color: [225, 29, 72] },
    ];

    const rowHeight = 14;
    let y = 65;
    rows.forEach((row, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(marginX, y - 8, pageWidth - marginX * 2, rowHeight, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(row.label, marginX + 4, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(row.color[0], row.color[1], row.color[2]);
      doc.text(`$${this.formatAmount(row.value)}`, pageWidth - marginX - 4, y, { align: 'right' });

      y += rowHeight;
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y + 4, pageWidth - marginX, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Generado automáticamente por Kontrol Cash', marginX, y + 12);

    doc.save(`${safePeriod}-cierre.pdf`);
  }

  formatPeriodLabel(period: string | undefined): string {
    if (!period) return 'N/A';
    const [year, month] = period.split('-');
    const nombre = MESES[parseInt(month, 10) - 1] ?? month;
    return `${nombre} ${year}`;
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private async loadImageAsDataUrl(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`No se pudo cargar el logo (${response.status})`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private sanitizeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, '-');
  }

  private storageKey(uid: string): string {
    return `monthly-close-${uid}`;
  }

  private safeParse(raw: string | null): MonthlyCloseSnapshot[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as MonthlyCloseSnapshot[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
