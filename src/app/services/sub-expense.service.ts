import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SubExpense } from '../models/sub-expense.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SubExpenseService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private basePath(userId: string, year: string, month: string, expenseId: string): string {
    return `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/gastos/${expenseId}/subgastos`;
  }

  // 🔹 GET: Obtener los subgastos de un gasto
  getSubExpenses(userId: string, year: string, month: string, expenseId: string): Observable<{ [key: string]: SubExpense }> {
    const base = `${this.basePath(userId, year, month, expenseId)}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: SubExpense }>(url).pipe(
          map(data => data || {}),
          catchError(error => {
            console.error('[GET] Error al obtener subgastos:', error);
            return of({});
          })
        );
      })
    );
  }

  // 🔹 POST: Agregar un nuevo subgasto
  addSubExpense(userId: string, year: string, month: string, expenseId: string, sub: SubExpense): Observable<any> {
    const base = `${this.basePath(userId, year, month, expenseId)}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, sub).pipe(
          catchError(error => {
            console.error('[POST] Error al agregar subgasto:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 PUT: Actualizar un subgasto existente
  updateSubExpense(userId: string, year: string, month: string, expenseId: string, subId: string, sub: SubExpense): Observable<any> {
    const base = `${this.basePath(userId, year, month, expenseId)}/${subId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, sub).pipe(
          catchError(error => {
            console.error('[PUT] Error al actualizar subgasto:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 DELETE: Eliminar un subgasto
  deleteSubExpense(userId: string, year: string, month: string, expenseId: string, subId: string): Observable<any> {
    const base = `${this.basePath(userId, year, month, expenseId)}/${subId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError(error => {
            console.error('[DELETE] Error al eliminar subgasto:', error);
            return of(null);
          })
        );
      })
    );
  }
}
