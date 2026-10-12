import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { WalletAccount, WalletMovement, WalletMovementType, WalletMovementWithId } from '../models/wallet.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly FIREBASE_BASE_URL = 'https://micartera-acd5b-default-rtdb.firebaseio.com';

  constructor(private http: HttpClient, private auth: AuthService) {}

  // 🔹 GET: Obtener cuentas de cartera
  getWallet(userId: string, year: string, month: string): Observable<{ [key: string]: WalletAccount }> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/cartera.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: WalletAccount }>(url).pipe(
          map(data => data || {}),
          catchError(error => {
            console.error('[GET] Error al obtener cartera:', error);
            return of({});
          })
        );
      })
    );
  }

  // 🔹 POST: Agregar cuenta nueva
  addAccount(userId: string, year: string, month: string, account: WalletAccount): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/cartera.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, account).pipe(
          catchError(error => {
            console.error('[POST] Error al agregar cuenta:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 PATCH: Actualizar cuenta existente
  // Importante: PATCH (no PUT) porque PUT reemplaza el nodo completo en Firebase, incluyendo
  // hijos que no vienen en el body — y 'movimientos' vive anidado bajo esta misma cuenta.
  // Con PUT, cada actualización de saldo borraba el historial de movimientos de esa billetera.
  updateAccount(userId: string, year: string, month: string, accountId: string, account: WalletAccount): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/cartera/${accountId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.patch(url, account).pipe(
          catchError(error => {
            console.error('[PATCH] Error al actualizar cuenta:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 DELETE: Eliminar cuenta
  deleteAccount(userId: string, year: string, month: string, accountId: string): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/cartera/${accountId}.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.delete(url).pipe(
          catchError(error => {
            console.error('[DELETE] Error al eliminar cuenta:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 POST: Agregar un movimiento al historial de una billetera (uso interno)
  private addMovimiento(userId: string, year: string, month: string, accountId: string, movimiento: WalletMovement): Observable<any> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/cartera/${accountId}/movimientos.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.post(url, movimiento).pipe(
          catchError(error => {
            console.error('[POST] Error al registrar movimiento:', error);
            return of(null);
          })
        );
      })
    );
  }

  // 🔹 Actualiza el saldo de una billetera y registra el movimiento que lo originó, en la misma operación.
  // Es el único punto por el que debería pasar cualquier cambio de saldo, para que el historial nunca quede con huecos.
  registrarMovimiento(
    userId: string,
    year: string,
    month: string,
    accountId: string,
    walletActual: WalletAccount,
    monto: number,
    tipo: WalletMovementType,
    descripcion: string,
    referenciaId?: string,
    billeteraRelacionada?: string
  ): Observable<number> {
    const nuevoValor = walletActual.valor + monto;
    const movimiento = new WalletMovement(
      Date.now(),
      tipo,
      monto,
      descripcion,
      nuevoValor,
      referenciaId,
      billeteraRelacionada
    );

    return forkJoin([
      this.updateAccount(userId, year, month, accountId, { tipo: walletActual.tipo, valor: nuevoValor, fijo: walletActual.fijo }),
      this.addMovimiento(userId, year, month, accountId, movimiento),
    ]).pipe(map(() => nuevoValor));
  }

  // 🔹 GET: Obtener el historial de movimientos de una billetera, más reciente primero
  getMovimientos(userId: string, year: string, month: string, accountId: string): Observable<WalletMovementWithId[]> {
    const base = `${this.FIREBASE_BASE_URL}/${userId}/${year}/${month}/cartera/${accountId}/movimientos.json`;
    return from(this.auth.getIdToken()).pipe(
      switchMap((token) => {
        const url = token ? `${base}?auth=${token}` : base;
        return this.http.get<{ [key: string]: WalletMovement }>(url).pipe(
          map(data => Object.entries(data || {})
            .map(([id, item]) => ({ id, ...item }))
            .sort((a, b) => b.fecha - a.fecha)
          ),
          catchError(error => {
            console.error('[GET] Error al obtener movimientos:', error);
            return of([]);
          })
        );
      })
    );
  }
}
