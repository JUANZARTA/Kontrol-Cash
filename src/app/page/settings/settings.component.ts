import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserSettingsService } from '../../services/user-settings.service';
import { ThemeService } from '../../services/theme.service';
import { DateService } from '../../services/date.service';
import { MonthlyCloseService } from '../../services/monthly-close.service';
import { UserSystemSettings, defaultUserSystemSettings } from '../../models/user-settings.model';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { BiometricService } from '../../core/biometric.service';
import { CHANGELOG, ChangelogEntry } from '../../core/changelog';
import { APP_VERSION } from '../../core/version';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, ModalShellComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export default class SettingsComponent implements OnInit, OnDestroy {
  private settingsService = inject(UserSettingsService);
  private themeService = inject(ThemeService);
  private dateService = inject(DateService);
  private closeService = inject(MonthlyCloseService);
  private router = inject(Router);
  biometric = inject(BiometricService);

  readonly user = JSON.parse(localStorage.getItem('user') || '{}');
  readonly userId = this.user?.localId || '';
  settings: UserSystemSettings = { ...defaultUserSystemSettings };
  biometricSupported = signal(false);
  biometricBusy = signal(false);

  readonly changelog = CHANGELOG;
  readonly appVersion = APP_VERSION;
  selectedChangelogEntry: ChangelogEntry | null = null;
  selectedPhotoFile: File | null = null;
  profilePhotoPreview = 'assets/img/logoIcono.png';
  selectedPhotoName = '';
  isSaving = false;
  feedbackMessage = '';

  currentYear = '';
  currentMonth = '';
  showClearMonthConfirm = false;
  isClearingMonth = false;
  clearMonthMessage = '';
  private dateSub?: Subscription;

  ngOnInit(): void {
    this.biometric.isSupported().then((ok) => this.biometricSupported.set(ok));

    this.dateSub = this.dateService.selectedDate$.subscribe((date) => {
      if (date.year && date.month) {
        this.currentYear = date.year;
        this.currentMonth = date.month;
      }
    });

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

  ngOnDestroy(): void {
    this.dateSub?.unsubscribe();
  }

  get currentPeriodLabel(): string {
    if (!this.currentYear || !this.currentMonth) return '';
    const date = new Date(parseInt(this.currentYear), parseInt(this.currentMonth) - 1, 1);
    return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }

  goToMonthClose(): void {
    this.router.navigate(['/app/month-close']);
  }

  clearMonth(): void {
    this.showClearMonthConfirm = false;
    this.isClearingMonth = true;
    this.clearMonthMessage = '';
    const clearedPeriodLabel = this.currentPeriodLabel;
    this.closeService.clearMonth(this.userId, this.currentYear, this.currentMonth).subscribe(() => {
      this.isClearingMonth = false;
      this.clearMonthMessage = `Se vació el mes de ${clearedPeriodLabel}.`;
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

  toggleSetting(key: 'darkMode' | 'showVehicle' | 'showLoans' | 'showDebts' | 'showStatistics' | 'useCustomColor'): void {
    this.settings[key] = !this.settings[key];
    if (key === 'darkMode') this.onDarkModeToggle();
    if (key === 'useCustomColor') this.onCustomColorToggle();
  }

  // Activa/desactiva el bloqueo por huella. No es seguridad real: solo crea/borra una
  // credencial WebAuthn de plataforma que desbloquea la UI con la sesión real ya viva.
  async toggleBiometric(): Promise<void> {
    if (this.biometricBusy()) return;
    if (this.biometric.enabled()) {
      this.biometric.disable();
      return;
    }
    const uid = this.user?.localId;
    if (!uid) return;
    this.biometricBusy.set(true);
    try {
      await this.biometric.enable(uid);
    } catch {
      // el mensaje queda en biometric.error()
    } finally {
      this.biometricBusy.set(false);
    }
  }

  openChangelogEntry(entry: ChangelogEntry): void {
    this.selectedChangelogEntry = entry;
  }

  closeChangelogEntry(): void {
    this.selectedChangelogEntry = null;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeChangelogEntry();
  }

  // Cierra el modal de notas de versión si el click fue fuera de él
  @HostListener('document:click', ['$event'])
  onDocumentClickForChangelog(event: MouseEvent): void {
    if (!this.selectedChangelogEntry) return;
    const target = event.target as HTMLElement;
    if (target.closest('.changelog-card') || target.closest('[data-modal="changelog"]')) return;
    this.closeChangelogEntry();
  }
}
