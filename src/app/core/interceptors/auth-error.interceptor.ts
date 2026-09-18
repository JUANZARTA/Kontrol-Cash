import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';

/**
 * Cada service atrapa sus propios errores con catchError(() => of(null/false/[])), así que un
 * 401 por token vencido nunca llegaba a ningún componente — solo se veía como "sin datos".
 * Este interceptor corta eso: cualquier 401 fuerza logout + redirección al login.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      if (error?.status === 401 && authService.isLoggedIn()) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
