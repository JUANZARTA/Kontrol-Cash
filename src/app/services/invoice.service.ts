import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Invoice } from '../models/invoice.model';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  constructor(private http: HttpClient) {}

  getInvoices(userId: string, year: string, month: string): Observable<any> {
    return this.http.get(`/api/invoices/${userId}/${year}/${month}`);
  }

  addInvoice(userId: string, year: string, month: string, invoice: Invoice): Observable<any> {
    return this.http.post(`/api/invoices/${userId}/${year}/${month}`, invoice);
  }

  updateInvoice(userId: string, year: string, month: string, id: string, invoice: Invoice): Observable<any> {
    return this.http.put(`/api/invoices/${userId}/${year}/${month}/${id}`, invoice);
  }

  deleteInvoice(userId: string, year: string, month: string, id: string): Observable<any> {
    return this.http.delete(`/api/invoices/${userId}/${year}/${month}/${id}`);
  }
}
