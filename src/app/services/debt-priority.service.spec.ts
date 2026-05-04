import { DebtPriorityService } from './debt-priority.service';

describe('DebtPriorityService', () => {
  it('ranks debts deterministically by weighted score', () => {
    const service = new DebtPriorityService();
    const debts = [
      { id: 'a', acreedor: 'A', fecha_deuda: '2026-01-01', fecha_pago: '2026-05-30', valor: 1000, estado: 'Pendiente' as const, interestRate: 22, penaltyFee: 80, minPayment: 100, daysPastDue: 10 },
      { id: 'b', acreedor: 'B', fecha_deuda: '2026-01-01', fecha_pago: '2026-05-20', valor: 1200, estado: 'Pendiente' as const, interestRate: 30, penaltyFee: 20, minPayment: 50, daysPastDue: 0 },
    ];

    const result1 = service.rank(debts);
    const result2 = service.rank(debts);

    expect(result1.map((item) => item.debt.id)).toEqual(result2.map((item) => item.debt.id));
    expect(result1[0].debt.id).toBe('a');
    expect(result1[0].score.factors.penalty).toBeGreaterThan(result1[1].score.factors.penalty);
  });
});
