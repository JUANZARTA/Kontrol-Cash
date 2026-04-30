import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Expense } from '../models/expense.model';
import { Income } from '../models/income.model';
import { RecurrentItem, RecurrentItemType, SavingGoal } from '../models/planner.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class PlannerService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getCustomCategories(userId: string, type: RecurrentItemType): Observable<string[]> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/customCategories/${type}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<string[]>(url).pipe(
          map((data) => data || []),
          catchError(() => of([]))
        );
      })
    );
  }

  saveCustomCategories(userId: string, type: RecurrentItemType, categories: string[]): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/customCategories/${type}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, categories).pipe(catchError(() => of(null)));
      })
    );
  }

  getRecurringItems(userId: string, type?: RecurrentItemType): Observable<RecurrentItem[]> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/recurringItems.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<Record<string, RecurrentItem>>(url).pipe(
          map((data) => {
            const items = Object.entries(data || {}).map(([id, item]) => ({ id, ...item }));
            return type ? items.filter((item) => item.tipo === type) : items;
          }),
          catchError(() => of([]))
        );
      })
    );
  }

  addRecurringItem(userId: string, item: RecurrentItem): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/recurringItems.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, item).pipe(catchError(() => of(null)));
      })
    );
  }

  deleteRecurringItem(userId: string, itemId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/recurringItems/${itemId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(catchError(() => of(null)));
      })
    );
  }

  getSavingGoal(userId: string): Observable<SavingGoal | null> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/savingGoal.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<SavingGoal | null>(url).pipe(catchError(() => of(null)));
      })
    );
  }

  saveSavingGoal(userId: string, goal: SavingGoal): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/config/savingGoal.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, goal).pipe(catchError(() => of(null)));
      })
    );
  }

  ensureRecurringItemsApplied(
    userId: string,
    year: string,
    month: string,
    incomeService: { addIncome: (userId: string, year: string, month: string, income: Income) => Observable<any> },
    expenseService: { addExpense: (userId: string, year: string, month: string, expense: Expense) => Observable<any> }
  ): Observable<boolean> {
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = `${now.getMonth() + 1}`.padStart(2, '0');

    if (year !== currentYear || month !== currentMonth) {
      return of(false);
    }

    const flagBase = `${this.FIREBASE_BASE_URL}/${userId}/config/recurringApplications/${year}-${month}.json`;

    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const flagUrl = token ? `${flagBase}?auth=${token}` : flagBase;
        return this.http.get<boolean | null>(flagUrl).pipe(
          catchError(() => of(null)),
          switchMap((alreadyApplied) => {
            if (alreadyApplied) {
              return of(false);
            }

            return this.getRecurringItems(userId).pipe(
              switchMap((items) => {
                const activeItems = items.filter((item) => item.activo);
                if (!activeItems.length) {
                  return this.http.put(flagUrl, true).pipe(map(() => false), catchError(() => of(false)));
                }

                const operations = activeItems.map((item) => {
                  if (item.tipo === 'income') {
                    return incomeService.addIncome(userId, year, month, {
                      nombre: item.nombre,
                      categoria: item.categoria,
                      valor: item.monto,
                    } as Income);
                  }

                  return expenseService.addExpense(userId, year, month, {
                    descripcion: item.nombre,
                    categoria: item.categoria,
                    valor: 0,
                    estimacion: item.monto,
                  } as Expense);
                });

                return forkJoin(operations).pipe(
                  switchMap(() => this.http.put(flagUrl, true)),
                  map(() => true),
                  catchError(() => of(false))
                );
              })
            );
          })
        );
      })
    );
  }
}
