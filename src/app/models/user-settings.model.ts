export interface UserSystemSettings {
  nombre: string;
  correo: string;
  profilePhotoUrl?: string;
  darkMode: boolean;
  showVehicle: boolean;
  showLoans: boolean;
  showDebts: boolean;
  showStatistics: boolean;
  useCustomColor: boolean;
  accentColor: string;
  pandaLeadToken?: string;
  // Interruptor LOCAL (de este lado): false = apaga la sincronización sin borrar el token
  // guardado, y bloquea "Configurar conexión". undefined se trata como true (encendido) para
  // no afectar a quien ya estaba conectado antes de este campo.
  pandaLeadEnabled?: boolean;
  // Meses (formato "yyyy-mm") donde el usuario borró a mano la fila sincronizada de Panda
  // Lead: mientras estén acá, la sincronización no la vuelve a crear en ese mes.
  pandaLeadExcludedMonths?: string[];
}

export const defaultUserSystemSettings: UserSystemSettings = {
  nombre: '',
  correo: '',
  profilePhotoUrl: '',
  darkMode: false,
  showVehicle: true,
  showLoans: true,
  showDebts: true,
  showStatistics: true,
  useCustomColor: false,
  accentColor: '#0ea5e9',
};
