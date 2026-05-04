export interface DebtPriorityFactors {
  interest: number;
  penalty: number;
  minPressure: number;
  delinquency: number;
}

export interface DebtPriorityScore {
  debtId: string;
  total: number;
  factors: DebtPriorityFactors;
}
