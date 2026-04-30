export enum CategoriaGasto {
    Fijo = 'Fijo',
    Variable = 'Variables',
    Facturas = 'Facturas',
    Comida = 'Comida',
    Transporte = 'Transporte',
    Salud = 'Salud',
    Entretenimiento = 'Entretenimiento',
    Emergencia = 'Emergencia',
    Otro = 'Otro'
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
