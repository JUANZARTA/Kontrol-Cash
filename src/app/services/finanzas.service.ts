import { Injectable, inject } from '@angular/core';
import { IncomeService } from './income.service';
import { ExpenseService } from './expense.service';
import { WalletService } from './wallet.service';
import { LoanService } from './loans.service';

@Injectable({
  providedIn: 'root',
})
export class FinanzasService {
  private incomeService = inject(IncomeService);
  private expenseService = inject(ExpenseService);
  private walletService = inject(WalletService);
  private loansService = inject(LoanService);

  mostrarEstadoFinanciero(
    componente: any,
    userId: string,
    year: string,
    month: string
  ) {
    const ingresos$ = this.incomeService.getIncomes(userId, year, month);
    const gastos$ = this.expenseService.getExpenses(userId, year, month);
    const wallet$ = this.walletService.getWallet(userId, year, month);
    const prestamos$ = this.loansService.getLoans(userId, year, month);

    ingresos$.subscribe((incomes) => {
      const ingresos = Object.values(incomes || {});

      gastos$.subscribe((expenses) => {
        const gastos = Object.values(expenses || {});

        wallet$.subscribe((wallet) => {
          const walletData = Object.values(wallet || {});

          prestamos$.subscribe((loans) => {
            const prestamos = Object.values(loans || {});

            // Totales de ingresos y gastos
            const ingresoTotal = ingresos.reduce(
              (a: number, i: any) => a + (i.valor || 0),
              0
            );
            const gastoTotal = gastos.reduce(
              (a: number, g: any) => a + (g.valor || 0),
              0
            );

            // Total de billeteras
            const walletTotal = walletData.reduce(
              (a: number, w: any) => a + (w.valor || 0),
              0
            );

            // Solo préstamos pendientes para el cuadre (saldo restante, no valor total)
            const prestamosPendientes = prestamos
              .filter((l: any) => l.estado !== 'Pagado')
              .reduce((a: number, l: any) => {
                const total = Math.max(1, Math.floor(l.totalCuotas ?? 1));
                const pagadas = Math.max(0, Math.min(Math.floor(l.cuotasPagadas ?? 0), total));
                const restantes = total - pagadas;
                return a + (restantes / total) * (l.valor || 0);
              }, 0);

            // Préstamos ya pagados (opcional, para mostrar)
            const prestamosPagados = prestamos
              .filter((l: any) => l.estado === 'Pagado')
              .reduce((a: number, l: any) => a + (l.valor || 0), 0);

            // Cálculo del cuadre/descuadre
            const restante = ingresoTotal - gastoTotal;
            const diferencia = walletTotal + prestamosPendientes - restante;

            if (diferencia > 0) {
              componente.estadoFinanciero = `Tienes ${this.formatCurrency(
                diferencia
              )} sin justificar. Puede ser un ingreso no registrado.`;
              componente.estadoFinancieroColor = 'azul';
            } else if (diferencia < 0) {
              componente.estadoFinanciero = `Tienes un descuadre de ${this.formatCurrency(
                Math.abs(diferencia)
              )}. Revisa tus ingresos, gastos o cartera.`;
              componente.estadoFinancieroColor = 'rojo';
            } else {
              componente.estadoFinanciero =
                'Tus cuentas están al día. Todo cuadra perfectamente.';
              componente.estadoFinancieroColor = 'verde';
            }

            // Valores que puedes usar en tu componente
            componente.cuadreDescuadre = diferencia;
            componente.prestamosPendientes = prestamosPendientes;
            componente.prestamosPagados = prestamosPagados;

            componente.estimacionGastosMes = gastos.reduce(
              (a: number, g: any) => a + (g.estimacion || 0),
              0
            );
            componente.estimacionDineroRestanteMes =
              ingresoTotal - componente.estimacionGastosMes;
            componente.gastadoActualmente = gastoTotal;
            componente.restanteActualmente =
              ingresoTotal - gastoTotal - prestamosPendientes;
            componente.restanteTotal = ingresoTotal - gastoTotal;
            componente.diferenciaSaldo =
              componente.estimacionDineroRestanteMes -
              componente.restanteActualmente;
          });
        });
      });
    });
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-EC').format(value);
  }
}
