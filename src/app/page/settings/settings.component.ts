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
import { PandaLeadService } from '../../services/panda-lead.service';

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
  pandaLead = inject(PandaLeadService);

  readonly user = JSON.parse(localStorage.getItem('user') || '{}');
  readonly userId = this.user?.localId || '';
  settings: UserSystemSettings = { ...defaultUserSystemSettings };
  biometricSupported = signal(false);
  biometricBusy = signal(false);

  readonly changelog = CHANGELOG;
  readonly appVersion = APP_VERSION;
  readonly tutorialVideoUrl = 'https://youtube.com/shorts/xQYTQ2W8Vcw';

  openTutorial(): void {
    if (!this.tutorialVideoUrl) return;
    window.open(this.tutorialVideoUrl, '_blank', 'noopener');
  }
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
  isDownloadingPdf = false;
  private dateSub?: Subscription;

  // Modal: Conexión con Panda Lead
  isPandaLeadModalOpen = false;
  pandaLeadTokenInput = '';
  pandaLeadError = '';
  isSavingPandaLeadToken = false;

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

  downloadCurrentPdf(): void {
    if (this.isDownloadingPdf || !this.userId || !this.currentYear || !this.currentMonth) return;
    this.isDownloadingPdf = true;
    this.closeService.buildCurrentSnapshot(this.userId, this.currentYear, this.currentMonth).subscribe({
      next: (snapshot) => {
        this.closeService.downloadPdf(snapshot, this.userId).finally(() => {
          this.isDownloadingPdf = false;
        });
      },
      error: () => {
        this.isDownloadingPdf = false;
      },
    });
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

  // ======================
  // Modal: Conexión con Panda Lead
  // ======================
  get isPandaLeadConnected(): boolean {
    return !!this.settings.pandaLeadToken;
  }

  // undefined se trata como encendido, para no afectar a quien ya estaba conectado antes de
  // que existiera este interruptor.
  get isPandaLeadEnabled(): boolean {
    return this.settings.pandaLeadEnabled !== false;
  }

  togglePandaLeadEnabled(): void {
    if (!this.settings.pandaLeadToken) return;
    const next = !this.isPandaLeadEnabled;
    const payload: UserSystemSettings = { ...this.settings, pandaLeadEnabled: next };
    this.settingsService.saveSettings(this.userId, payload).subscribe(() => {
      this.settings.pandaLeadEnabled = next;
      if (!next) {
        // Apagado: estos avisos ya no aplican, el ciclo de sync ni siquiera va a correr.
        this.pandaLead.connectionWarning.set(false);
        this.pandaLead.remotePaused.set(false);
      }
    });
  }

  openPandaLeadModal(): void {
    if (this.isPandaLeadConnected && !this.isPandaLeadEnabled) return; // apagado: ni configurar
    this.pandaLeadTokenInput = this.settings.pandaLeadToken || '';
    this.pandaLeadError = '';
    this.isPandaLeadModalOpen = true;
  }

  closePandaLeadModal(): void {
    this.isPandaLeadModalOpen = false;
    this.pandaLeadTokenInput = '';
    this.pandaLeadError = '';
  }

  savePandaLeadToken(): void {
    const token = this.pandaLeadTokenInput.trim();
    if (!token || this.isSavingPandaLeadToken) return;

    this.isSavingPandaLeadToken = true;
    this.pandaLeadError = '';

    this.pandaLead.validateToken(token).subscribe((valido) => {
      if (!valido) {
        this.isSavingPandaLeadToken = false;
        this.pandaLeadError = 'Token inválido.';
        return;
      }

      const payload: UserSystemSettings = { ...this.settings, pandaLeadToken: token, pandaLeadEnabled: true };
      this.settingsService.saveSettings(this.userId, payload).subscribe({
        next: () => {
          this.settings.pandaLeadToken = token;
          this.settings.pandaLeadEnabled = true;
          this.pandaLead.connectionWarning.set(false);
          this.pandaLead.markConnected(token);
          this.isSavingPandaLeadToken = false;
          this.closePandaLeadModal();
        },
        error: () => {
          this.isSavingPandaLeadToken = false;
          this.pandaLeadError = 'No se pudo guardar la conexión.';
        },
      });
    });
  }

  disconnectPandaLead(): void {
    const tokenToClear = this.settings.pandaLeadToken || '';
    const payload: UserSystemSettings = { ...this.settings, pandaLeadToken: '', pandaLeadExcludedMonths: [] };
    this.settingsService.saveSettings(this.userId, payload).subscribe(() => {
      this.settings.pandaLeadToken = '';
      this.settings.pandaLeadExcludedMonths = [];
      this.pandaLead.connectionWarning.set(false);
      if (tokenToClear) {
        this.pandaLead.clearConnectionMarks(tokenToClear);
        if (this.currentYear && this.currentMonth) {
          this.pandaLead.stripOrigenForMonth(this.userId, this.currentYear, this.currentMonth);
        }
      }
      this.closePandaLeadModal();
    });
  }

  isResyncingPandaLead = false;

  resyncPandaLeadMonth(): void {
    if (!this.settings.pandaLeadToken || !this.currentYear || !this.currentMonth || this.isResyncingPandaLead) return;

    this.isResyncingPandaLead = true;
    this.feedbackMessage = 'Resincronizando este mes con Panda Lead...';
    const yyyyMm = `${this.currentYear}-${this.currentMonth}`;

    this.pandaLead.resyncMonth(this.userId, this.settings.pandaLeadToken, this.currentYear, this.currentMonth).subscribe((result) => {
      this.isResyncingPandaLead = false;
      // Se quita acá también localmente: resyncMonth ya lo sacó de la lista en el servidor,
      // pero este componente guardó `this.settings` como una copia propia al cargar la página,
      // así que si no la actualizamos acá el aviso/botón se quedan pegados aunque sí funcionó.
      this.settings.pandaLeadExcludedMonths = (this.settings.pandaLeadExcludedMonths || []).filter((m) => m !== yyyyMm);

      switch (result) {
        case 'synced':
          this.feedbackMessage = 'Mes resincronizado con Panda Lead.';
          break;
        case 'no-income':
          this.feedbackMessage = 'Panda Lead no tiene ingresos este mes.';
          break;
        case 'paused':
          this.feedbackMessage = 'La conexión está pausada desde Panda Lead.';
          break;
        case 'invalid-token':
          this.feedbackMessage = 'El token de Panda Lead ya no es válido.';
          break;
        case 'error':
          this.feedbackMessage = 'No se pudo resincronizar, intentá de nuevo.';
          break;
      }
    });
  }

  get isCurrentMonthExcludedFromPandaLead(): boolean {
    const yyyyMm = `${this.currentYear}-${this.currentMonth}`;
    return (this.settings.pandaLeadExcludedMonths || []).includes(yyyyMm);
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
