export class Saving {
  constructor(
    public tipo: string,
    public valor: number,
    public nombre?: string,
    public metaAhorro?: number
  ) {}
}

export interface SavingWithId extends Saving {
  id: string;
}

export interface SavingMovement {
  nombre: string;
  valor: number;
}

export interface SavingMovementWithId extends SavingMovement {
  id: string;
}
