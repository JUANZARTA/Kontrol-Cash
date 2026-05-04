import { Injectable } from '@angular/core';
import { Debt } from '../models/debt.model';
import { DebtPriorityFactors, DebtPriorityScore } from '../models/debt-priority.model';

export interface RankedDebt {
  debt: Debt & { id: string };
  score: DebtPriorityScore;
}

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

@Injectable({ providedIn: 'root' })
export class DebtPriorityService {
  rank(debts: Array<Debt & { id: string }>): RankedDebt[] {
    const maxApr = Math.max(...debts.map((d) => d.interestRate ?? 0), 1);
    const maxPenalty = Math.max(...debts.map((d) => d.penaltyFee ?? 0), 1);
    const maxMinPressure = Math.max(...debts.map((d) => (d.minPayment ?? 0) / Math.max(1, d.valor)), 1);
    const maxDaysPastDue = Math.max(...debts.map((d) => d.daysPastDue ?? 0), 1);

    return debts
      .map((debt) => {
        const factors: DebtPriorityFactors = {
          interest: normalize(debt.interestRate ?? 0, maxApr),
          penalty: normalize(debt.penaltyFee ?? 0, maxPenalty),
          minPressure: normalize((debt.minPayment ?? 0) / Math.max(1, debt.valor), maxMinPressure),
          delinquency: normalize(debt.daysPastDue ?? 0, maxDaysPastDue),
        };

        const total =
          0.4 * factors.interest +
          0.25 * factors.penalty +
          0.25 * factors.minPressure +
          0.1 * factors.delinquency;

        return {
          debt,
          score: { debtId: debt.id, total, factors },
        };
      })
      .sort((a, b) => {
        if (b.score.total !== a.score.total) {
          return b.score.total - a.score.total;
        }

        const dueDiff = new Date(a.debt.fecha_pago).getTime() - new Date(b.debt.fecha_pago).getTime();
        if (dueDiff !== 0) return dueDiff;

        return b.debt.valor - a.debt.valor;
      });
  }
}
