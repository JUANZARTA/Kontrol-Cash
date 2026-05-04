import { Injectable } from '@angular/core';

export interface Projection {
  period: string;
  projectedEndBalance: number;
  variancePct: number;
  confidence: 'low' | 'medium' | 'high';
  inputs: { elapsedDays: number; totalDays: number; dailyRunRate: number };
}

export function calculateProjection(params: {
  period: string;
  currentBalance: number;
  monthIncome: number;
  monthExpense: number;
  elapsedDays: number;
  totalDays: number;
  currentPlan: number;
  highVarianceThresholdPct?: number;
}): Projection {
  const elapsedDays = Math.max(1, params.elapsedDays);
  const totalDays = Math.max(elapsedDays, params.totalDays);
  const dailyRunRate = (params.monthIncome - params.monthExpense) / elapsedDays;
  const projectedEndBalance = params.currentBalance + dailyRunRate * (totalDays - elapsedDays);
  const variancePct = Math.abs(projectedEndBalance - params.currentPlan) / Math.max(1, Math.abs(params.currentPlan));
  const threshold = params.highVarianceThresholdPct ?? 0.15;

  let confidence: 'low' | 'medium' | 'high' = 'high';
  if (variancePct > threshold) {
    confidence = 'low';
  } else if (variancePct > threshold / 2) {
    confidence = 'medium';
  }

  return {
    period: params.period,
    projectedEndBalance,
    variancePct,
    confidence,
    inputs: { elapsedDays, totalDays, dailyRunRate },
  };
}

@Injectable({ providedIn: 'root' })
export class ProjectionService {
  calculate(params: Parameters<typeof calculateProjection>[0]): Projection {
    return calculateProjection(params);
  }
}
