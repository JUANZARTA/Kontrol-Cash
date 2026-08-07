import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MonthlyCloseService } from '../services/monthly-close.service';
import { DateService } from '../services/date.service';

// Rutas que quedan accesibles aunque haya un mes sin cerrar — la del cierre en sí,
// y configuración por si hace falta "Vaciar mes" como salida de emergencia.
const ALLOWED_PATHS = ['/app/month-close', '/app/settings'];

/**
 * Bloquea la navegación a cualquier pantalla de /app si hay un mes calendario real
 * anterior que todavía no se cerró — obliga a pasar por /app/month-close antes de
 * poder seguir registrando datos. Reemplaza al cierre automático (fallaba en producción).
 */
export const PendingCloseGuard: CanActivateFn = (_route, state: RouterStateSnapshot): Observable<boolean> | boolean => {
  const closeService = inject(MonthlyCloseService);
  const dateService = inject(DateService);
  const router = inject(Router);

  if (ALLOWED_PATHS.some(path => state.url.startsWith(path))) {
    return true;
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?.localId;
  if (!userId) return true;

  return closeService.getPendingClosePeriod(userId).pipe(
    map(pending => {
      if (!pending) return true;
      dateService.setDate(parseInt(pending.year, 10), parseInt(pending.month, 10));
      router.navigate(['/app/month-close']);
      return false;
    })
  );
};
