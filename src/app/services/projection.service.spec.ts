import { calculateProjection } from './projection.service';

describe('calculateProjection', () => {
  it('calculates projected balance with positive pace', () => {
    const projection = calculateProjection({
      period: '2026-05',
      currentBalance: 1000,
      monthIncome: 2000,
      monthExpense: 1000,
      elapsedDays: 10,
      totalDays: 30,
      currentPlan: 2500,
    });

    expect(projection.projectedEndBalance).toBe(3000);
    expect(projection.confidence).toBe('low');
  });

  it('returns medium confidence near threshold', () => {
    const projection = calculateProjection({
      period: '2026-05',
      currentBalance: 2000,
      monthIncome: 1500,
      monthExpense: 1200,
      elapsedDays: 10,
      totalDays: 30,
      currentPlan: 2300,
      highVarianceThresholdPct: 0.2,
    });

    expect(projection.confidence).toBe('medium');
    expect(projection.variancePct).toBeGreaterThan(0.1);
  });
});
