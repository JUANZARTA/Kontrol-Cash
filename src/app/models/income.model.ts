export enum CategoriaIngreso {
  Fijo = 'Fijo',
  Variable = 'Variable',
  Otro = 'Otro'
}

export class Income {
  constructor(
    public nombre: string,
    public categoria: string,
    public valor: number,
    // Marca interna, no editable desde la UI. 'pandalead' cuando el MONTO de esta fila lo
    // mantiene la integración con Panda Lead — nombre y categoría son libres, la sincronización
    // nunca los toca ni los usa para encontrar la fila.
    public origen?: string
  ) {}
}

export interface IncomeWithId extends Income {
  id: string;
}
