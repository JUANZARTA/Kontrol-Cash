import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Invoice } from '../models/invoice.model';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private readonly FIREBASE_BASE_URL =
    'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient) {}

  getInvoices(userId: string, year: string, month: string) {
    const url = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices.json`;
    return this.http.get<{ [key: string]: Invoice }>(url);
  }

  addInvoice(userId: string, year: string, month: string, invoice: Invoice) {
    const url = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices.json`;
    return this.http.post(url, invoice);
  }

  updateInvoice(
    userId: string,
    year: string,
    month: string,
    id: string,
    invoice: Invoice
  ) {
    const url = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices/${id}.json`;
    return this.http.put(url, invoice);
  }

  deleteInvoice(userId: string, year: string, month: string, id: string) {
    const url = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/invoices/${id}.json`;
    return this.http.delete(url);
  }
}
