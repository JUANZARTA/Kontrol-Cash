import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';

/**
 * Cada service atrapa sus propios errores con catchError(() => of(null/false/[])), así que un
 * 401 por token vencido nunca llegaba a ningún componente — solo se veía como "sin datos".
 * Este interceptor corta eso: cualquier 401 contra NUESTRA base de Firebase fuerza logout +
 * redirección al login.
 *
 * Importante: se filtra por dominio porque este interceptor corre sobre TODO HttpClient de la
 * app, incluyendo integraciones externas como Panda Lead (otro proyecto de Firebase). Un 401 de
 * esa base no significa que la sesión de Kontrol Cash haya vencido — sin este filtro, un error
 * ahí cerraba la sesión del usuario sin motivo.
 */
const KONTROL_CASH_FIREBASE_HOST = 'micartera-acd5b-default-rtdb.firebaseio.com';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      if (error?.status === 401 && req.url.includes(KONTROL_CASH_FIREBASE_HOST) && authService.isLoggedIn()) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
