import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Estado de conexión del navegador.
 *
 * Esta app NO carga el módulo `database` del SDK de Firebase (solo
 * `firebase/compat/auth`, ver auth.service.ts) y habla con Realtime Database
 * vía HTTP REST crudo. Por eso no hay `.info/connected` disponible: esa ruta
 * especial solo existe dentro del SDK de Database, que mantiene su propio
 * socket con el backend de Firebase. Agregarlo únicamente para esto sería
 * una dependencia nueva (más bundle, más superficie) para un beneficio chico:
 * en esta app cada escritura ya va por HTTP normal, así que un fetch fallido
 * se nota igual que un offline real.
 *
 * Por eso la señal se basa en `navigator.onLine` + los eventos `online` /
 * `offline` del browser. Limitación conocida y aceptada: un wifi "conectado
 * pero sin salida a internet" (portal cautivo, DNS caído, etc.) puede no
 * detectarse hasta que una llamada HTTP real falle en otro lado — pero no
 * requiere tocar el SDK de Firebase para algo que hoy no se usa.
 */
@Injectable({
  providedIn: 'root',
})
export class ConnectionService {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly offline = signal(false);

  private yaConecto = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.isBrowser) return;

    // Arranque: no confiamos en el primer estado hasta pasados 5s (evita
    // falsos positivos mientras el navegador todavía está resolviendo red).
    this.scheduleUpdate(navigator.onLine);

    window.addEventListener('online', () => this.scheduleUpdate(true));
    window.addEventListener('offline', () => this.scheduleUpdate(false));
  }

  private scheduleUpdate(conectado: boolean): void {
    if (this.timer) clearTimeout(this.timer);

    if (conectado) {
      this.yaConecto = true;
      this.offline.set(false);
      return;
    }

    // Debounce de micro-cortes (<1.5s) y espera larga en el arranque (5s)
    // para no parpadear el aviso.
    this.timer = setTimeout(() => this.offline.set(true), this.yaConecto ? 1500 : 5000);
  }
}
