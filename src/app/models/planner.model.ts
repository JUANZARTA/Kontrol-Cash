export type RecurrentItemType = 'income' | 'expense';

export interface RecurrentItem {
  id?: string;
  nombre: string;
  categoria: string;
  monto: number;
  tipo: RecurrentItemType;
  activo: boolean;
}

export interface SavingGoal {
  titulo: string;
  montoObjetivo: number;
}

export interface MonthlyHistoryItem {
  period: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  saldo: number;
}
