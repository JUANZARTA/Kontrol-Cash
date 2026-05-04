import { Injectable } from '@angular/core';
import { MonthlyCloseSnapshot } from '../models/monthly-close.model';

@Injectable({ providedIn: 'root' })
export class MonthlyCloseService {
  private sanitizeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, '-');
  }

  private toSafeTotals(snapshot: MonthlyCloseSnapshot): MonthlyCloseSnapshot['totals'] {
    return {
      income: snapshot?.totals?.income ?? 0,
      expense: snapshot?.totals?.expense ?? 0,
      net: snapshot?.totals?.net ?? 0,
      debtPending: snapshot?.totals?.debtPending ?? 0,
    };
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

  list(uid: string): MonthlyCloseSnapshot[] {
    if (!uid) return [];
    const raw = localStorage.getItem(this.storageKey(uid));
    const parsed = this.safeParse(raw);
    return parsed.sort((a, b) => b.period.localeCompare(a.period));
  }

  closeMonth(uid: string, snapshot: MonthlyCloseSnapshot): void {
    if (!uid || !snapshot?.period) return;
    const all = this.list(uid);
    const exists = all.some((item) => item.period === snapshot.period);
    if (exists) return;
    localStorage.setItem(this.storageKey(uid), JSON.stringify([...all, snapshot]));
  }

  downloadPdf(snapshot: MonthlyCloseSnapshot): void {
    const safePeriod = this.sanitizeFilePart(snapshot?.period || 'periodo');
    const totals = this.toSafeTotals(snapshot);
    const content = [
      `Cierre mensual ${snapshot?.period || 'N/A'}`,
      `Ingresos: ${totals.income}`,
      `Gastos: ${totals.expense}`,
      `Neto: ${totals.net}`,
      `Deuda pendiente: ${totals.debtPending}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safePeriod}-resumen.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
