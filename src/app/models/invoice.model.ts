export interface Invoice {
  nombre: string;      // Nombre de la factura
  fechaPago: string;   // Fecha de pago (formato YYYY-MM-DD)
  valor: number;       // Valor de la factura
}
export interface InvoiceWithId extends Invoice {
  id: string;
  showMenu: boolean;
}