export interface UserSystemSettings {
  nombre: string;
  correo: string;
  profilePhotoUrl?: string;
  accentColor?: string;
  darkMode: boolean;
  showVehicle: boolean;
  showLoans: boolean;
  showDebts: boolean;
}

export const defaultUserSystemSettings: UserSystemSettings = {
  nombre: '',
  correo: '',
  profilePhotoUrl: '',
  accentColor: '#0ea5e9',
  darkMode: false,
  showVehicle: true,
  showLoans: true,
  showDebts: true,
};
