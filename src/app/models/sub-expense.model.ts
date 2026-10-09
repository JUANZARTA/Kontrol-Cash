export class SubExpense {
  constructor(
    public nombre: string,
    public valor: number,
    public walletId?: string
  ) {}
}

export interface SubExpenseWithId extends SubExpense {
  id: string;
}
