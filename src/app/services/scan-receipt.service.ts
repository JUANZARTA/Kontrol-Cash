import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { createWorker } from 'tesseract.js';

export interface ScannedItem {
  nombre: string;
  precio: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ScanReceiptService {

  scan(file: File): Observable<ScannedItem[]> {
    return from(this.runOcr(file));
  }

  private async runOcr(file: File): Promise<ScannedItem[]> {
    const worker = await createWorker('spa');
    try {
      const { data: { text } } = await worker.recognize(file);
      return this.parseReceiptText(text);
    } finally {
      await worker.terminate();
    }
  }

  private parseReceiptText(text: string): ScannedItem[] {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    const items: ScannedItem[] = [];

    const skip = /total|subtotal|iva|impuesto|descuento|cambio|efectivo|tarjeta|propina|vuelto|gracias|nit|ruc|fecha|hora|caja|cajero|ticket|factura|recibo|dirección|teléfono|domicil/i;

    for (const line of lines) {
      if (skip.test(line)) continue;

      // Busca un número al final de la línea (precio)
      const priceMatch = line.match(/([\d.,]+)\s*$/);
      if (!priceMatch) continue;

      const precio = this.parsePrice(priceMatch[1]);
      if (precio <= 0 || precio > 99_000_000) continue;

      let nombre = line.slice(0, priceMatch.index).trim();
      if (!nombre || nombre.length < 2) continue;

      // Detecta cantidad al inicio: "2 x Item" o "2x Item"
      let cantidad = 1;
      const qtyMatch = nombre.match(/^(\d{1,2})\s*[xX]\s+(.+)/);
      if (qtyMatch) {
        cantidad = parseInt(qtyMatch[1], 10);
        nombre = qtyMatch[2].trim();
      }

      // Limpia números sueltos al final del nombre
      nombre = nombre.replace(/\s+\d+$/, '').trim();
      if (nombre.length < 2) continue;

      items.push({ nombre, precio, cantidad });
    }

    return items;
  }

  private parsePrice(raw: string): number {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    let cleaned = raw;

    if (lastComma > lastDot) {
      // Formato europeo: 1.234,56 → 1234.56
      cleaned = raw.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      const afterDot = raw.slice(lastDot + 1);
      if (afterDot.length === 3) {
        // Punto como separador de miles: 1.234 → 1234
        cleaned = raw.replace(/\./g, '').replace(',', '');
      }
      // Si afterDot !== 3, asume decimal normal: 1.50
    } else {
      cleaned = raw.replace(/,/g, '');
    }

    return parseFloat(cleaned) || 0;
  }
}
