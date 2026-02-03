import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Invoice } from '../models/invoice.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private readonly FIREBASE_BASE_URL =
    'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  getInvoices(userId: string, year: string, month: string) {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: Invoice }>(url).pipe(
          map((d) => d || {}),
          catchError(err => {
            console.error('[Invoice] Error al cargar facturas', err);
            return of({});
          })
        );
      })
    );
  }

  addInvoice(userId: string, year: string, month: string, invoice: Invoice) {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, invoice).pipe(
          catchError(err => {
            console.error('[Invoice] Error al guardar factura', err);
            return of(null);
          })
        );
      })
    );
  }

  updateInvoice(
    userId: string,
    year: string,
    month: string,
    id: string,
    invoice: Invoice
  ) {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices/${id}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.put(url, invoice).pipe(
          catchError(err => {
            console.error('[Invoice] Error al actualizar factura', err);
            return of(null);
          })
        );
      })
    );
  }

  deleteInvoice(userId: string, year: string, month: string, id: string) {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices/${id}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError(err => {
            console.error('[Invoice] Error al eliminar factura', err);
            return of(null);
          })
        );
      })
    );
  }
}
