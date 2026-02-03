import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Debt } from '../models/debt.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DebtService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getDebts(userId: string, year: string, month: string): Observable<{ [key: string]: Debt }> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/deudas.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: Debt }>(url).pipe(
          map(data => data || {}),
          catchError(error => {
            console.error('[GET] Error al obtener deudas:', error);
            return of({});
          })
        );
      })
    );
  }

  addDebt(userId: string, year: string, month: string, debt: Debt): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/deudas.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, debt).pipe(
          catchError(error => {
            console.error('[POST] Error al agregar deuda:', error);
            return of(null);
          })
        );
      })
    );
  }

  updateDebt(userId: string, year: string, month: string, debtId: string, debt: Debt): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/deudas/${debtId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, debt).pipe(
          catchError(error => {
            console.error('[PUT] Error al actualizar deuda:', error);
            return of(null);
          })
        );
      })
    );
  }

  deleteDebt(userId: string, year: string, month: string, debtId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/deudas/${debtId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError(error => {
            console.error('[DELETE] Error al eliminar deuda:', error);
            return of(null);
          })
        );
      })
    );
  }
}
