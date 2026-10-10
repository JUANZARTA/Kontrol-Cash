import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BiometricService } from '../core/biometric.service';

export const BiometricLockGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const biometric = inject(BiometricService);
  const router = inject(Router);

  if (authService.isLoggedIn() && biometric.isEnabled() && biometric.locked()) {
    return router.createUrlTree(['/login']);
  }
  return true;
};
