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
