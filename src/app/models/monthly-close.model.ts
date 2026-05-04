export interface MonthlyClosePdfMetadata {
  path: string;
  size: number;
  sha256: string;
}

export interface MonthlyCloseSnapshot {
  period: string;
  closedAt: string;
  totals: {
    income: number;
    expense: number;
    net: number;
    debtPending: number;
  };
  categories: Record<string, number>;
  pdf: MonthlyClosePdfMetadata;
}
