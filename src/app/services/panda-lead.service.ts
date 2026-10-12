import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { IncomeService } from './income.service';
import { UserSettingsService } from './user-settings.service';
import { Income, IncomeWithId } from '../models/income.model';

const GOLDEN_PANDA_NOMBRE = 'Golden Panda';
const GOLDEN_PANDA_CATEGORIA = 'Empresa';
const PANDA_LEAD_ORIGEN = 'pandalead';

export type PandaLeadResyncResult = 'synced' | 'no-income' | 'paused' | 'invalid-token' | 'error';

@Injectable({
  providedIn: 'root',
})
export class PandaLeadService {
  // Proyecto de Firebase de Panda Lead (CRM, app distinta del mismo dueño). Es otra base,
  // no la de Kontrol Cash. Solo se lee kontrolLinks/{token}/incomeByMonth, incomeUpdatedAt,
  // paused y displayName, y solo se escriben kontrolConnectedAt/kontrolLastSyncAt/kontrolEnabled
  // (marcas de aviso para Panda Lead) — nunca ningún otro campo.
  private readonly BASE_URL = 'https://pandalead-b2e09-default-rtdb.firebaseio.com';

  // true = el token guardado dejó de servir (Panda Lead lo revocó/regeneró). Se muestra
  // como aviso discreto en Settings, sin borrar nada.
  readonly connectionWarning = signal(false);

  // true = Panda Lead pausó la conexión de su lado (campo `paused`). No se guarda localmente,
  // se relee en cada ciclo de sincronización.
  readonly remotePaused = signal(false);

  constructor(
    private http: HttpClient,
    private incomeService: IncomeService,
    private settingsService: UserSettingsService
  ) {}

  // Nunca loguear `token` ni el objeto de error completo (puede traer la URL con el token).
  validateToken(token: string): Observable<boolean> {
    const url = `${this.BASE_URL}/kontrolLinks/${encodeURIComponent(token)}/incomeUpdatedAt.json`;
    return this.http.get<number | null>(url).pipe(
      map((value) => typeof value === 'number'),
      catchError(() => of(false))
    );
  }

  // Una sola lectura por ciclo: todo el nodo del token (paused, displayName, incomeByMonth del
  // mes pedido). undefined = falló el request -> el caller NO debe tocar nada, reintenta después.
  private fetchSyncData(token: string, yyyyMm: string): Observable<{ paused: boolean; displayName: string | null; valor: number | null } | undefined> {
    const url = `${this.BASE_URL}/kontrolLinks/${encodeURIComponent(token)}.json`;
    return this.http.get<any>(url).pipe(
      map((data) => ({
        paused: data?.paused === true,
        displayName: typeof data?.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : null,
        valor: typeof data?.incomeByMonth?.[yyyyMm] === 'number' ? data.incomeByMonth[yyyyMm] : null,
      })),
      catchError(() => of(undefined))
    );
  }

  // Sincroniza el mes (year, month) indicado: trae el valor de Panda Lead y hace upsert de la
  // fila "Golden Panda" en la Tabla de Ingresos de Kontrol Cash. Idempotente — correrlo varias
  // veces seguidas con el mismo valor no genera escrituras de más ni filas duplicadas.
  syncMonth(userId: string, token: string, year: string, month: string): void {
    if (!userId || !token || !year || !month) return;
    if (this.settingsService.current.pandaLeadEnabled === false) return; // apagado local, ni siquiera consulta
    const yyyyMm = `${year}-${month}`;
    if (this.isMonthExcluded(yyyyMm)) return; // el usuario borró la fila acá, no se vuelve a crear sola

    this.fetchSyncData(token, yyyyMm).subscribe((data) => {
      if (data === undefined) return; // falló el request: no tocar nada, se reintenta en el próximo ciclo

      this.remotePaused.set(data.paused);
      if (data.paused) return; // pausada desde Panda Lead: no leer ingresos, no tocar filas, no marcar sync

      if (data.valor === null) {
        // Ambiguo: puede ser "sin cobros este mes" (token OK) o "token revocado".
        // Se re-chequea contra incomeUpdatedAt para decidir.
        this.validateToken(token).subscribe((valido) => {
          this.connectionWarning.set(!valido);
          if (valido) {
            this.markSynced(token);
            this.upsertGoldenPanda(userId, year, month, 0, data.displayName);
          }
        });
        return;
      }

      this.connectionWarning.set(false);
      this.markSynced(token);
      this.upsertGoldenPanda(userId, year, month, data.valor, data.displayName);
    });
  }

  // Marca kontrolConnectedAt = Date.now() del lado de Panda Lead. Se llama al guardar un token
  // recién validado, y una vez al abrir la app si ya había un token guardado.
  markConnected(token: string): void {
    this.writeField(token, 'kontrolConnectedAt', Date.now()).subscribe();
  }

  // Marca kontrolLastSyncAt = Date.now() del lado de Panda Lead, después de cada sincronización
  // de ingresos exitosa (el GET de incomeByMonth respondió, sin importar si hubo o no cambios).
  markSynced(token: string): void {
    this.writeField(token, 'kontrolLastSyncAt', Date.now()).subscribe();
  }

  // Avisa a Panda Lead el estado del interruptor local (ON/OFF). Se llama cada vez que cambia
  // el token o el interruptor — ver el subscribe a settings$ en layout.component.ts.
  writeEnabled(token: string, enabled: boolean): void {
    this.writeField(token, 'kontrolEnabled', enabled).subscribe();
  }

  // Borra las tres marcas de conexión del lado de Panda Lead. Se llama al desconectar.
  clearConnectionMarks(token: string): void {
    this.deleteField(token, 'kontrolConnectedAt').subscribe();
    this.deleteField(token, 'kontrolLastSyncAt').subscribe();
    this.deleteField(token, 'kontrolEnabled').subscribe();
  }

  // Escritura de "aviso" para Panda Lead: si falla, no debe romper nada del lado de Kontrol
  // Cash ni mostrarle algo al usuario — por eso el catchError se traga el error. Se loguea el
  // código HTTP (nunca el token) para poder diagnosticar en desarrollo.
  private writeField(token: string, field: 'kontrolConnectedAt' | 'kontrolLastSyncAt' | 'kontrolEnabled', value: number | boolean): Observable<boolean> {
    const url = `${this.BASE_URL}/kontrolLinks/${encodeURIComponent(token)}/${field}.json`;
    return this.http.put(url, value, { observe: 'response' }).pipe(
      map((res) => {
        console.log(`aviso conexión: ${res.status}`);
        return res.ok;
      }),
      catchError((err) => {
        console.log(`aviso conexión: ${err?.status ?? 'error'}`);
        return of(false);
      })
    );
  }

  private deleteField(token: string, field: 'kontrolConnectedAt' | 'kontrolLastSyncAt' | 'kontrolEnabled'): Observable<boolean> {
    const url = `${this.BASE_URL}/kontrolLinks/${encodeURIComponent(token)}/${field}.json`;
    return this.http.delete(url, { observe: 'response' }).pipe(
      map((res) => {
        console.log(`aviso conexión: ${res.status}`);
        return res.ok;
      }),
      catchError((err) => {
        console.log(`aviso conexión: ${err?.status ?? 'error'}`);
        return of(false);
      })
    );
  }

  // displayName viene de Panda Lead (perfil del usuario ahí); si es null/vacío se usa "Golden
  // Panda" como respaldo SOLO al crear la fila — una fila existente nunca pierde el nombre que
  // ya tenía por un displayName vacío (regla 5 del spec).
  private upsertGoldenPanda(userId: string, year: string, month: string, valor: number, displayName: string | null): void {
    this.incomeService.getIncomes(userId, year, month).subscribe((data) => {
      const entries = this.migrateLegacyRows(userId, year, month, Object.entries(data || {}) as [string, IncomeWithId][]);
      const existing = entries.find(([, inc]) => inc.origen === PANDA_LEAD_ORIGEN);

      if (existing) {
        const [id, inc] = existing;
        const fields: Partial<Income> = {};
        if (Number(inc.valor) !== valor) fields.valor = valor;
        if (displayName && inc.nombre !== displayName) fields.nombre = displayName;
        if (Object.keys(fields).length === 0) return; // ya está al día, no escribir de más
        this.incomeService.updateIncomeFields(userId, year, month, id, fields).subscribe();
      } else if (valor > 0) {
        const nuevo = new Income(displayName || GOLDEN_PANDA_NOMBRE, GOLDEN_PANDA_CATEGORIA, valor, PANDA_LEAD_ORIGEN);
        this.incomeService.addIncome(userId, year, month, nuevo).subscribe();
      }
    });
  }

  // Migración de filas creadas por la versión anterior (emparejaba por nombre "Golden Panda",
  // sin la marca `origen`). Se corre cada vez que el mes se sincroniza, así cubre cualquier mes
  // que el usuario visite, sin necesitar un escaneo completo del historial que RTDB no permite
  // hacer barato desde el cliente. Si hay duplicadas en el mismo mes, se queda con la de mayor
  // ingreso y borra el resto. Devuelve la lista de entries ya reflejando el resultado.
  private migrateLegacyRows(
    userId: string, year: string, month: string, entries: [string, IncomeWithId][]
  ): [string, IncomeWithId][] {
    const legacy = entries.filter(([, inc]) => inc.nombre === GOLDEN_PANDA_NOMBRE && !inc.origen);
    if (legacy.length === 0) return entries;

    const survivor = legacy.reduce((a, b) => (Number(b[1].valor) > Number(a[1].valor) ? b : a));
    const [survivorId, survivorInc] = survivor;

    legacy.forEach(([id]) => {
      if (id !== survivorId) this.incomeService.deleteIncome(userId, year, month, id).subscribe();
    });
    this.incomeService.updateIncomeFields(userId, year, month, survivorId, { origen: PANDA_LEAD_ORIGEN }).subscribe();
    if (legacy.length > 1) {
      console.log(`Panda Lead: se encontraron ${legacy.length} filas "Golden Panda" duplicadas en ${year}-${month}; se conservó la de mayor ingreso.`);
    }

    survivorInc.origen = PANDA_LEAD_ORIGEN; // refleja la migración en memoria para el resto de este ciclo
    const discardedIds = new Set(legacy.filter(([id]) => id !== survivorId).map(([id]) => id));
    return entries.filter(([id]) => !discardedIds.has(id));
  }

  private isMonthExcluded(yyyyMm: string): boolean {
    return (this.settingsService.current.pandaLeadExcludedMonths || []).includes(yyyyMm);
  }

  // El usuario borró a mano la fila sincronizada de este mes: se excluye para que no se recree sola.
  excludeMonth(userId: string, year: string, month: string): void {
    const yyyyMm = `${year}-${month}`;
    if (this.isMonthExcluded(yyyyMm)) return;
    const excluded = [...(this.settingsService.current.pandaLeadExcludedMonths || []), yyyyMm];
    this.settingsService.saveSettings(userId, { ...this.settingsService.current, pandaLeadExcludedMonths: excluded }).subscribe();
  }

  // Quita la exclusión del mes indicado y lo sincroniza de inmediato (no espera al ciclo de
  // 60s). Usado por el botón "Resincronizar este mes" en Configuración. A diferencia de
  // syncMonth (fire-and-forget, pensado para el ciclo en segundo plano), esto devuelve el
  // resultado para que el caller pueda avisarle al usuario qué pasó y refrescar su propio
  // estado local — si no, el botón/aviso se quedan pegados aunque la sincronización sí haya
  // funcionado.
  resyncMonth(userId: string, token: string, year: string, month: string): Observable<PandaLeadResyncResult> {
    const yyyyMm = `${year}-${month}`;
    const excluded = this.settingsService.current.pandaLeadExcludedMonths || [];
    const clearExclusion$ = excluded.includes(yyyyMm)
      ? this.settingsService.saveSettings(userId, {
          ...this.settingsService.current,
          pandaLeadExcludedMonths: excluded.filter((m) => m !== yyyyMm),
        })
      : of(null);

    return clearExclusion$.pipe(
      switchMap(() => this.fetchSyncData(token, yyyyMm)),
      switchMap((data): Observable<PandaLeadResyncResult> => {
        if (data === undefined) return of('error');
        this.remotePaused.set(data.paused);
        if (data.paused) return of('paused');

        if (!data.valor) {
          // 0 o null: puede ser "sin cobros este mes" (token OK) o "token revocado".
          return this.validateToken(token).pipe(
            map((valido): PandaLeadResyncResult => {
              this.connectionWarning.set(!valido);
              if (!valido) return 'invalid-token';
              this.markSynced(token);
              this.upsertGoldenPanda(userId, year, month, 0, data.displayName);
              return 'no-income';
            })
          );
        }

        this.connectionWarning.set(false);
        this.markSynced(token);
        this.upsertGoldenPanda(userId, year, month, data.valor, data.displayName);
        return of('synced');
      })
    );
  }

  // Al desconectar: le saca la marca `origen` a la fila del mes activo (si existe) para que
  // quede como una fila normal, con el valor que tenía — no se borra nada, se conserva el
  // historial. Limpiar `pandaLeadToken` y `pandaLeadExcludedMonths` en settings queda del lado
  // del caller (settings.component.ts), para hacerlo en un solo saveSettings y evitar pisadas
  // entre dos guardados separados.
  // Nota: solo se puede tocar el mes cargado en memoria en este momento; filas sincronizadas de
  // OTROS meses se quedan con la marca `origen` puesta, pero quedan inertes (sin token, nada las
  // vuelve a tocar) — no generan duplicados ni cambian de valor por su cuenta.
  stripOrigenForMonth(userId: string, year: string, month: string): void {
    this.incomeService.getIncomes(userId, year, month).subscribe((data) => {
      const entries = Object.entries(data || {}) as [string, IncomeWithId][];
      const synced = entries.find(([, inc]) => inc.origen === PANDA_LEAD_ORIGEN);
      if (synced) {
        this.incomeService.updateIncomeFields(userId, year, month, synced[0], { origen: null as any }).subscribe();
      }
    });
  }
}
