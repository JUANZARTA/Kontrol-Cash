import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Income } from '../models/income.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class IncomeService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  // 🔹 GET: Obtener todos los ingresos de un mes/año/usuario
  getIncomes(userId: string, year: string, month: string): Observable<{ [key: string]: Income }> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ingresos.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: Income }>(url).pipe(
          map(data => data || {}),
          catchError(error => {
            console.error('[GET] Error al obtener ingresos:', error);
            return of({});
          })
        );
      })
    );
  }

  // 🔹 POST: Agregar un nuevo ingreso
  addIncome(userId: string, year: string, month: string, income: Income): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ingresos.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, income).pipe(
          catchError(error => {
            console.error('[POST] Error al agregar ingreso:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 PUT: Actualizar un ingreso existente
  updateIncome(userId: string, year: string, month: string, incomeId: string, income: Income): Observable<any> {
    const url = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ingresos/${incomeId}.json`;
    return this.http.put(url, income).pipe(
      catchError(error => {
        console.error('[PUT] Error al actualizar ingreso:', error);
        return of(null);
      })
    );
  }

  // 🔹 DELETE: Eliminar un ingreso
  deleteIncome(userId: string, year: string, month: string, incomeId: string): Observable<any> {
    const url = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/ingresos/${incomeId}.json`;
    return this.http.delete(url).pipe(
      catchError(error => {
        console.error('[DELETE] Error al eliminar ingreso:', error);
        return of(null);
      })
    );
  }
}
