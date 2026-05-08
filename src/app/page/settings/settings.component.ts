import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserSettingsService } from '../../services/user-settings.service';
import { ThemeService } from '../../services/theme.service';
import { UserSystemSettings, defaultUserSystemSettings } from '../../models/user-settings.model';
import firebase from 'firebase/compat/app';
import 'firebase/compat/storage';

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
  accentColor = '#0ea5e9';
  selectedPhotoFile: File | null = null;
  profilePhotoPreview = 'assets/img/logoIcono.png';
  selectedPhotoName = '';

  ngOnInit(): void {
    if (!this.userId) return;
    this.settingsService.getSettings(this.userId).subscribe((settings) => {
      this.settings = {
        ...settings,
        nombre: settings.nombre || this.user?.name || '',
        correo: settings.correo || this.user?.email || '',
      };
      this.profilePhotoPreview = this.settings.profilePhotoUrl || this.user?.profilePhotoUrl || 'assets/img/logoIcono.png';
      this.themeService.setTheme(this.settings.darkMode ? 'dark' : 'light');
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedPhotoFile = file;
    this.selectedPhotoName = file.name;
  }

  private async uploadProfilePhotoIfNeeded(): Promise<string> {
    if (!this.selectedPhotoFile || !this.userId) {
      return this.settings.profilePhotoUrl || this.user?.profilePhotoUrl || '';
    }

    const ext = this.selectedPhotoFile.name.split('.').pop() || 'jpg';
    const filePath = `profile-photos/${this.userId}/avatar.${ext}`;
    const storageRef = firebase.storage().ref(filePath);
    await storageRef.put(this.selectedPhotoFile);
    return await storageRef.getDownloadURL();
  }

  onDarkModeToggle(): void {
    this.themeService.setTheme(this.settings.darkMode ? 'dark' : 'light');
  }

  async save(): Promise<void> {
    if (!this.userId) return;

    const profilePhotoUrl = await this.uploadProfilePhotoIfNeeded();
    const payload: UserSystemSettings = {
      ...this.settings,
      nombre: (this.settings.nombre || '').trim(),
      correo: this.user?.email || this.settings.correo,
      profilePhotoUrl,
    };
    this.settingsService.saveSettings(this.userId, payload).subscribe();

    const localUser = { ...this.user, name: payload.nombre, email: payload.correo, profilePhotoUrl };
    localStorage.setItem('user', JSON.stringify(localUser));
    this.profilePhotoPreview = profilePhotoUrl || this.profilePhotoPreview;
    this.selectedPhotoFile = null;
    this.selectedPhotoName = '';
  }

  toggleSetting(key: 'darkMode' | 'showVehicle' | 'showLoans' | 'showDebts'): void {
    this.settings[key] = !this.settings[key];
    if (key === 'darkMode') {
      this.onDarkModeToggle();
    }
  }
}
