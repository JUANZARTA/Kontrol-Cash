export enum CategoriaGasto {
    Fijo = 'Fijo',
    Variable = 'Variables',
    Comida = 'Comida',
    Facturas = 'Facturas',
    Deuda = 'Deuda',
    Entretenimiento = 'Entretenimiento',
    Salud = 'Salud',
    Emergencia = 'Emergencia',
    Transporte = 'Transporte',
    Otro = 'Otro',
  }

  export class Expense {
    constructor(
      public descripcion: string,
      public categoria: string,
      public valor: number,
      public estimacion: number
    ) {}
  }
  export interface ExpenseWithId extends Expense {
    id: string;
  }
