import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { UserSystemSettings, defaultUserSystemSettings } from '../models/user-settings.model';

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';
  private readonly settingsSubject = new BehaviorSubject<UserSystemSettings>(defaultUserSystemSettings);
  readonly settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const safe = (hex || '#0ea5e9').replace('#', '');
    const normalized = safe.length === 3 ? safe.split('').map((c) => c + c).join('') : safe;
    const r = parseInt(normalized.substring(0, 2), 16) / 255;
    const g = parseInt(normalized.substring(2, 4), 16) / 255;
    const b = parseInt(normalized.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

    if (d !== 0) {
      switch (max) {
        case r:
          h = 60 * (((g - b) / d) % 6);
          break;
        case g:
          h = 60 * ((b - r) / d + 2);
          break;
        default:
          h = 60 * ((r - g) / d + 4);
          break;
      }
    }

    if (h < 0) h += 360;
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  private setThemePalette(color?: string): void {
    if (typeof document === 'undefined') return;
    const accent = color || '#0ea5e9';
    const { h, s } = this.hexToHsl(accent);
    const root = document.documentElement;

    root.style.setProperty('--app-accent', accent);
    root.style.setProperty('--app-accent-strong', `hsl(${h} ${this.clamp(s + 8, 35, 95)}% 38%)`);
    root.style.setProperty('--app-accent-soft', `hsl(${h} ${this.clamp(s, 30, 90)}% 92%)`);

    // Light theme palette
    root.style.setProperty('--app-bg-light', `hsl(${h} 38% 97%)`);
    root.style.setProperty('--app-bg-soft-light', `hsl(${h} 34% 94%)`);
    root.style.setProperty('--app-surface-light', `hsla(${h}, 35%, 99%, 0.92)`);
    root.style.setProperty('--app-card-light', `hsl(${h} 28% 99%)`);
    root.style.setProperty('--app-border-light', `hsl(${h} 22% 86%)`);
    root.style.setProperty('--app-text-light', `hsl(${h} 25% 13%)`);
    root.style.setProperty('--app-muted-light', `hsl(${h} 14% 38%)`);
    root.style.setProperty('--app-muted-soft-light', `hsl(${h} 12% 58%)`);

    // Dark theme palette
    root.style.setProperty('--app-bg-dark', `hsl(${h} 32% 7%)`);
    root.style.setProperty('--app-bg-soft-dark', `hsl(${h} 28% 13%)`);
    root.style.setProperty('--app-surface-dark', `hsla(${h}, 24%, 16%, 0.92)`);
    root.style.setProperty('--app-card-dark', `hsl(${h} 24% 15%)`);
    root.style.setProperty('--app-border-dark', `hsla(${h}, 15%, 70%, 0.26)`);
    root.style.setProperty('--app-text-dark', `hsl(${h} 35% 95%)`);
    root.style.setProperty('--app-muted-dark', `hsl(${h} 18% 80%)`);
    root.style.setProperty('--app-muted-soft-dark', `hsl(${h} 12% 62%)`);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mi-cartera-accent', accent);
    }
  }

  applyAccentTheme(color?: string): void {
    this.setThemePalette(color);
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
            this.setThemePalette(settings.accentColor);
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
            this.setThemePalette(settings.accentColor);
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
