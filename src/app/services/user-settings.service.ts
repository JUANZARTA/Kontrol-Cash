import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { UserSystemSettings, defaultUserSystemSettings } from '../models/user-settings.model';
import { FIXED_THEME_PALETTE, ThemePaletteVars } from '../theme/fixed-palette';
import { buildEditablePalette } from '../theme/editable-palette';

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';
  private readonly settingsSubject = new BehaviorSubject<UserSystemSettings>(defaultUserSystemSettings);
  readonly settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  private applyPaletteVars(palette: ThemePaletteVars): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.entries(palette).forEach(([key, value]) => root.style.setProperty(key, value));
  }

  private applyPaletteModeClass(allowCustomPalette: boolean): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (allowCustomPalette) {
      root.classList.remove('palette-fixed');
    } else {
      root.classList.add('palette-fixed');
    }
  }

  private setThemePalette(color?: string, allowCustomPalette = true): void {
    const accent = color || '#0ea5e9';
    const palette = allowCustomPalette ? buildEditablePalette(accent) : FIXED_THEME_PALETTE;
    this.applyPaletteVars(palette);
    this.applyPaletteModeClass(allowCustomPalette);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mi-cartera-accent', accent);
      window.localStorage.setItem('mi-cartera-allow-custom-palette', String(allowCustomPalette));
    }
  }

  applyAccentTheme(color?: string, allowCustomPalette = true): void {
    this.setThemePalette(color, allowCustomPalette);
  }

  getSettings(userId: string): Observable<UserSystemSettings> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/configuracion-sistema.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<Partial<UserSystemSettings>>(url).pipe(
          map((data) => ({ ...defaultUserSystemSettings, ...(data || {}) })),
          tap((settings) => {
            this.settingsSubject.next(settings);
            this.setThemePalette(settings.accentColor, settings.allowCustomPalette !== false);
          }),
          catchError((error) => {
            console.error('[GET] Error al cargar configuración de usuario:', error);
            return of(defaultUserSystemSettings);
          })
        );
      })
    );
  }

  saveSettings(userId: string, settings: UserSystemSettings): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/configuracion-sistema.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.patch(url, settings).pipe(
          tap(() => {
            this.settingsSubject.next(settings);
            this.setThemePalette(settings.accentColor, settings.allowCustomPalette !== false);
          }),
          catchError((error) => {
            console.error('[PATCH] Error al guardar configuración de usuario:', error);
            return of(null);
          })
        );
      })
    );
  }

  get current(): UserSystemSettings {
    return this.settingsSubject.value;
  }
}
