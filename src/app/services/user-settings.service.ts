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

  getSettings(userId: string): Observable<UserSystemSettings> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/configuracion-sistema.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<Partial<UserSystemSettings>>(url).pipe(
          map((data) => ({ ...defaultUserSystemSettings, ...(data || {}) })),
          tap((settings) => this.settingsSubject.next(settings)),
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
          tap(() => this.settingsSubject.next(settings)),
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
