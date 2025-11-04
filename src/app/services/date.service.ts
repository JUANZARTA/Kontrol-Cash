import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { HttpClient } from '@angular/common/http'; // ✅ nuevo
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DateService {
  private yearSubject: BehaviorSubject<string>;
  private monthSubject: BehaviorSubject<string>;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private http: HttpClient, // ✅ nuevo
    private authService: AuthService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      const savedYear = localStorage.getItem('selectedYear');
      const savedMonth = localStorage.getItem('selectedMonth');

      if (!savedYear || !savedMonth) {
        const now = new Date();
        const defaultYear = now.getFullYear().toString();
        const defaultMonth = (now.getMonth() + 1).toString().padStart(2, '0');

        localStorage.setItem('selectedYear', defaultYear);
        localStorage.setItem('selectedMonth', defaultMonth);

        this.yearSubject = new BehaviorSubject<string>(defaultYear);
        this.monthSubject = new BehaviorSubject<string>(defaultMonth);
      } else {
        this.yearSubject = new BehaviorSubject<string>(savedYear);
        this.monthSubject = new BehaviorSubject<string>(savedMonth);
      }
    } else {
      // SSR fallback
      this.yearSubject = new BehaviorSubject<string>('');
      this.monthSubject = new BehaviorSubject<string>('');
    }
  }

  get selectedYear$() {
    return this.yearSubject.asObservable();
  }

  get selectedMonth$() {
    return this.monthSubject.asObservable();
  }

  get selectedDate$() {
    return combineLatest([this.selectedYear$, this.selectedMonth$]).pipe(
      map(([year, month]) => ({ year, month }))
    );
  }

  setDate(year: number, month: number): void {
    const formattedMonth = month.toString().padStart(2, '0');
    this.yearSubject.next(year.toString());
    this.monthSubject.next(formattedMonth);

    if (this.isBrowser) {
      localStorage.setItem('selectedYear', year.toString());
      localStorage.setItem('selectedMonth', formattedMonth);
    }
  }

  getSelectedYear(): string {
    return this.yearSubject.value;
  }

  getSelectedMonth(): string {
    return this.monthSubject.value;
  }

  resetToCurrentDate(): void {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    this.yearSubject.next(year);
    this.monthSubject.next(month);

    if (this.isBrowser) {
      localStorage.setItem('selectedYear', year);
      localStorage.setItem('selectedMonth', month);
    }
  }

  // método: Notificar nuevo mes al usuario
  notifyMonthChange(uid: string, year: string, month: string): void {
    const mes = this.getMonthName(month);
    const mensaje = `Nuevo mes detectado: ${mes} ${year}`;
    
    // Usar el nuevo sistema de notificaciones con tipo
    this.authService.addNotification(uid, mensaje, 'cambio_mes').subscribe();
  }

  // método: Obtener nombre del mes en español
  getMonthName(month: string): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[parseInt(month) - 1] || '';
  }
}
