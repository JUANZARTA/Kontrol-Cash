export interface UserSystemSettings {
  nombre: string;
  correo: string;
  profilePhotoUrl?: string;
  darkMode: boolean;
  showVehicle: boolean;
  showLoans: boolean;
  showDebts: boolean;
  useCustomColor: boolean;
  accentColor: string;
}

export const defaultUserSystemSettings: UserSystemSettings = {
  nombre: '',
  correo: '',
  profilePhotoUrl: '',
  darkMode: false,
  showVehicle: true,
  showLoans: true,
  showDebts: true,
  useCustomColor: false,
  accentColor: '#0ea5e9',
};
