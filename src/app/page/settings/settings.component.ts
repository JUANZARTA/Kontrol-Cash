import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserSettingsService } from '../../services/user-settings.service';
import { ThemeService } from '../../services/theme.service';
import { UserSystemSettings, defaultUserSystemSettings } from '../../models/user-settings.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export default class SettingsComponent implements OnInit {
  private settingsService = inject(UserSettingsService);
  private themeService = inject(ThemeService);

  readonly user = JSON.parse(localStorage.getItem('user') || '{}');
  readonly userId = this.user?.localId || '';
  settings: UserSystemSettings = { ...defaultUserSystemSettings };
  selectedPhotoFile: File | null = null;
  profilePhotoPreview = 'assets/img/logoIcono.png';
  selectedPhotoName = '';
  isSaving = false;
  feedbackMessage = '';

  ngOnInit(): void {
    if (!this.userId) return;
    this.settingsService.getSettings(this.userId).subscribe((settings) => {
      this.settings = {
        ...defaultUserSystemSettings,
        ...settings,
        nombre: settings.nombre || this.user?.name || '',
        correo: settings.correo || this.user?.email || '',
      };
      this.profilePhotoPreview = this.settings.profilePhotoUrl || this.user?.profilePhotoUrl || 'assets/img/logoIcono.png';
      // Sincronizamos settings.darkMode al estado real del ThemeService (que refleja localStorage).
      // No llamamos setTheme() aquí para no revertir cambios hechos desde el navbar.
      this.settings.darkMode = this.themeService.isDarkMode();
      this.themeService.setCustomColorMode(this.settings.useCustomColor, this.settings.accentColor);
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedPhotoFile = file;
    this.selectedPhotoName = file.name;
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private async uploadProfilePhotoIfNeeded(): Promise<string> {
    if (!this.selectedPhotoFile || !this.userId) {
      return this.settings.profilePhotoUrl || this.user?.profilePhotoUrl || '';
    }

    // Fallback sin Firebase Storage (evita CORS en localhost)
    return await this.fileToDataUrl(this.selectedPhotoFile);
  }

  onDarkModeToggle(): void {
    this.themeService.setTheme(this.settings.darkMode ? 'dark' : 'light');
  }

  onCustomColorToggle(): void {
    this.themeService.setCustomColorMode(this.settings.useCustomColor, this.settings.accentColor);
  }

  onAccentColorChange(): void {
    if (this.settings.useCustomColor) {
      this.themeService.previewAccentColor(this.settings.accentColor);
    }
  }

  async save(): Promise<void> {
    if (!this.userId) return;

    this.isSaving = true;
    this.feedbackMessage = '';

    let profilePhotoUrl = this.settings.profilePhotoUrl || this.user?.profilePhotoUrl || '';
    try {
      profilePhotoUrl = await this.uploadProfilePhotoIfNeeded();
    } catch (error: any) {
      this.isSaving = false;
      this.feedbackMessage = 'No se pudo procesar la foto seleccionada.';
      console.error('Error subiendo foto de perfil:', error);
      return;
    }

    const payload: UserSystemSettings = {
      ...this.settings,
      nombre: (this.settings.nombre || '').trim(),
      correo: this.user?.email || this.settings.correo,
      profilePhotoUrl,
    };

    this.settingsService.saveSettings(this.userId, payload).subscribe({
      next: () => {
        const localUser = { ...this.user, name: payload.nombre, email: payload.correo, profilePhotoUrl };
        localStorage.setItem('user', JSON.stringify(localUser));
        this.profilePhotoPreview = profilePhotoUrl || this.profilePhotoPreview;
        this.selectedPhotoFile = null;
        this.selectedPhotoName = '';
        this.feedbackMessage = 'Configuración guardada correctamente.';
        this.isSaving = false;
      },
      error: (err) => {
        console.error('Error guardando configuración:', err);
        this.feedbackMessage = 'No se pudo guardar la configuración.';
        this.isSaving = false;
      },
    });
  }

  toggleSetting(key: 'darkMode' | 'showVehicle' | 'showLoans' | 'showDebts' | 'useCustomColor'): void {
    this.settings[key] = !this.settings[key];
    if (key === 'darkMode') this.onDarkModeToggle();
    if (key === 'useCustomColor') this.onCustomColorToggle();
  }
}
