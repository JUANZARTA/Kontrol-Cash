export class WalletAccount {
  constructor(
    public tipo: string,
    public valor: number,
    public fijo?: boolean
  ) {}
}

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu?: boolean;
}

export type WalletMovementType =
  | 'ingreso'
  | 'gasto'
  | 'devolucion_gasto'
  | 'deudor'
  | 'deuda'
  | 'vehiculo'
  | 'transferencia'
  | 'ajuste_manual';

export class WalletMovement {
  constructor(
    public fecha: number,
    public tipo: WalletMovementType,
    public monto: number,
    public descripcion: string,
    public saldoResultante: number,
    public referenciaId?: string,
    public billeteraRelacionada?: string
  ) {}
}

export interface WalletMovementWithId extends WalletMovement {
  id: string;
}
