import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Saving } from '../models/savings.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SavingsService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  // 🔹 GET: Obtener ahorros
  getSavings(userId: string, year: string, month: string): Observable<{ [key: string]: Saving }> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ahorros.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: Saving }>(url).pipe(
          map(data => data || {}),
          catchError(error => {
            console.error('[GET] Error al obtener ahorros:', error);
            return of({});
          })
        );
      })
    );
  }

  // 🔹 POST: Agregar ahorro
  addSaving(userId: string, year: string, month: string, saving: Saving): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ahorros.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, saving).pipe(
          catchError(error => {
            console.error('[POST] Error al agregar ahorro:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 PUT: Actualizar ahorro
  updateSaving(userId: string, year: string, month: string, savingId: string, saving: Saving): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ahorros/${savingId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, saving).pipe(
          catchError(error => {
            console.error('[PUT] Error al actualizar ahorro:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 DELETE: Eliminar ahorro
  deleteSaving(userId: string, year: string, month: string, savingId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ahorros/${savingId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError(error => {
            console.error('[DELETE] Error al eliminar ahorro:', error);
            return of(null);
          })
        );
      })
    );
  }
}
