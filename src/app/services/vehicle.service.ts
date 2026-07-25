import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { FuelEntry, FuelEntryWithId, FuelPump } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getFuelEntries(userId: string, year: string, month: string): Observable<{ [key: string]: FuelEntry }> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/tanqueos.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: FuelEntry }>(url).pipe(
          map((data) => data || {}),
          catchError((error) => {
            console.error('[GET] Error al obtener tanqueos:', error);
            return of({});
          })
        );
      })
    );
  }

  addFuelEntry(userId: string, year: string, month: string, entry: FuelEntry): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/tanqueos.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, entry).pipe(
          catchError((error) => {
            console.error('[POST] Error al agregar tanqueo:', error);
            return of(null);
          })
        );
      })
    );
  }

  updateFuelEntry(userId: string, year: string, month: string, entryId: string, entry: FuelEntry): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/tanqueos/${entryId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, entry).pipe(
          catchError((error) => {
            console.error('[PUT] Error al actualizar tanqueo:', error);
            return of(null);
          })
        );
      })
    );
  }

  deleteFuelEntry(userId: string, year: string, month: string, entryId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/tanqueos/${entryId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError((error) => {
            console.error('[DELETE] Error al eliminar tanqueo:', error);
            return of(null);
          })
        );
      })
    );
  }

  getFuelPumps(userId: string): Observable<{ [key: string]: FuelPump }> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/vehiculo-config/bombas.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: FuelPump }>(url).pipe(
          map((data) => data || {}),
          catchError((error) => {
            console.error('[GET] Error al obtener bombas:', error);
            return of({});
          })
        );
      })
    );
  }

  addFuelPump(userId: string, pump: FuelPump): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/vehiculo-config/bombas.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, pump).pipe(
          catchError((error) => {
            console.error('[POST] Error al crear bomba:', error);
            return of(null);
          })
        );
      })
    );
  }

  updateFuelPump(userId: string, pumpId: string, pump: FuelPump): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/vehiculo-config/bombas/${pumpId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, pump).pipe(
          catchError((error) => {
            console.error('[PUT] Error al editar bomba:', error);
            return of(null);
          })
        );
      })
    );
  }

  deleteFuelPump(userId: string, pumpId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/vehiculo-config/bombas/${pumpId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError((error) => {
            console.error('[DELETE] Error al eliminar bomba:', error);
            return of(null);
          })
        );
      })
    );
  }

  getGasolinaExpenseId(userId: string, year: string, month: string): Observable<string | null> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/gastoGasolinaId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<string | null>(url).pipe(catchError(() => of(null)));
      })
    );
  }

  setGasolinaExpenseId(userId: string, year: string, month: string, expenseId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/gastoGasolinaId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, JSON.stringify(expenseId)).pipe(catchError(() => of(null)));
      })
    );
  }

  clearGasolinaExpenseId(userId: string, year: string, month: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/vehiculo/gastoGasolinaId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(catchError(() => of(null)));
      })
    );
  }

  getAllRecentFuelEntries(userId: string, year: string, month: string, monthsBack = 18): Observable<FuelEntryWithId[]> {
    const periods: { year: string; month: string }[] = [];
    let y = parseInt(year, 10);
    let m = parseInt(month, 10);
    for (let i = 0; i < monthsBack; i++) {
      periods.push({ year: String(y), month: String(m).padStart(2, '0') });
      m--;
      if (m === 0) { m = 12; y--; }
    }
    return forkJoin(
      periods.map(p =>
        this.getFuelEntries(userId, p.year, p.month).pipe(
          map(data => Object.entries(data || {}).map(([id, item]: [string, any]) => ({ id, ...item } as FuelEntryWithId)))
        )
      )
    ).pipe(
      map(results => results.flat().filter((e: any) => e.fecha && !e.esReferencia).sort((a: any, b: any) =>
        new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      ))
    );
  }
}
