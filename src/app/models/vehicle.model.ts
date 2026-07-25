export interface FuelEntry {
  bombaId?: string;
  nombreBomba: string;
  precioGalon?: number;
  monto: number;
  galones: number;
  kilometraje: number;
  fecha: string;
  walletId?: string;
  expenseId?: string;
  /** Copia del último tanqueo del mes anterior dejada como punto de partida al cerrar el mes: no editable ni parte de las estadísticas del mes actual. */
  esReferencia?: boolean;
}

export interface FuelEntryWithId extends FuelEntry {
  id: string;
}

export interface FuelPump {
  nombre: string;
  precioGalon: number;
}

export interface FuelPumpWithId extends FuelPump {
  id: string;
}
