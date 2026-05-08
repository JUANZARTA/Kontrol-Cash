export class Debt {
  constructor(
    public acreedor: string,
    public fecha_deuda: string,
    public fecha_pago: string,
    public valor: number,
    public estado: 'Pendiente' | 'Pagado',
    public totalCuotas?: number,
    public cuotasPagadas?: number,
    public interestRate?: number,
    public penaltyFee?: number,
    public minPayment?: number,
    public daysPastDue?: number
  ) {}
}

export interface DebtWithId extends Debt {
  id: string;
}
