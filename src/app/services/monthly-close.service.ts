import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { MonthlyCloseSnapshot } from '../models/monthly-close.model';

@Injectable({ providedIn: 'root' })
export class MonthlyCloseService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly DB = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  getNextPeriod(year: string, month: string): { year: string; month: string } {
    const m = parseInt(month);
    const y = parseInt(year);
    if (m === 12) return { year: String(y + 1), month: '01' };
    return { year, month: String(m + 1).padStart(2, '0') };
  }

  isMonthClosed(userId: string, year: string, month: string): Observable<boolean> {
    const base = `${this.DB}/${userId}/${year}/${month}/cierreMes.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<boolean | null>(url).pipe(
          map(v => v === true),
          catchError(() => of(false))
        );
      })
    );
  }

  markMonthClosed(userId: string, year: string, month: string): Observable<any> {
    const base = `${this.DB}/${userId}/${year}/${month}/cierreMes.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, true).pipe(catchError(() => of(null)));
      })
    );
  }

  getMesAnteriorId(userId: string, year: string, month: string): Observable<string | null> {
    const base = `${this.DB}/${userId}/${year}/${month}/mesAnteriorId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<string | null>(url).pipe(catchError(() => of(null)));
      })
    );
  }

  setMesAnteriorId(userId: string, year: string, month: string, id: string): Observable<any> {
    const base = `${this.DB}/${userId}/${year}/${month}/mesAnteriorId.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, JSON.stringify(id)).pipe(catchError(() => of(null)));
      })
    );
  }

  // ── localStorage (snapshots de historial) ──────────────────────────────────

  list(uid: string): MonthlyCloseSnapshot[] {
    if (!uid) return [];
    const raw = localStorage.getItem(this.storageKey(uid));
    return this.safeParse(raw).sort((a, b) => b.period.localeCompare(a.period));
  }

  closeMonth(uid: string, snapshot: MonthlyCloseSnapshot): void {
    if (!uid || !snapshot?.period) return;
    const all = this.list(uid);
    const idx = all.findIndex(item => item.period === snapshot.period);
    if (idx >= 0) {
      all[idx] = snapshot;
    } else {
      all.push(snapshot);
    }
    localStorage.setItem(this.storageKey(uid), JSON.stringify(all));
  }

  downloadPdf(snapshot: MonthlyCloseSnapshot): void {
    const safePeriod = this.sanitizeFilePart(snapshot?.period || 'periodo');
    const t = snapshot?.totals;
    const content = [
      `Cierre mensual: ${snapshot?.period || 'N/A'}`,
      `Fecha de cierre: ${snapshot?.closedAt ? new Date(snapshot.closedAt).toLocaleDateString('es-CO') : 'N/A'}`,
      '',
      `Ingresos:        $${t?.income ?? 0}`,
      `Gastos:          $${t?.expense ?? 0}`,
      `Neto:            $${t?.net ?? 0}`,
      `Deuda pendiente: $${t?.debtPending ?? 0}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safePeriod}-resumen.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private sanitizeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, '-');
  }

  private storageKey(uid: string): string {
    return `monthly-close-${uid}`;
  }

  private safeParse(raw: string | null): MonthlyCloseSnapshot[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as MonthlyCloseSnapshot[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
