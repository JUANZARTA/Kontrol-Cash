import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard'; // 👈 Importa tu guard
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component')
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component')
  },
  {
    path: 'app',
    canActivate: [AuthGuard], // ✅ Aquí aplicas el guard a TODA la sección protegida
    loadComponent: () => import('./shared/components/layout/layout.component'),
    children: [
      { path: 'home', loadComponent: () => import('./page/home/home.component') },
      { path: 'expense', loadComponent: () => import('./page/expense/expense.component') },
      { path: 'income', loadComponent: () => import('./page/income/income.component') },
      { path: 'wallet', loadComponent: () => import('./page/wallet/wallet.component') },
      { path: 'saving', loadComponent: () => import('./page/savings/savings.component') },
      { path: 'loan', loadComponent: () => import('./page/loans/loans.component') },
      { path: 'debt', loadComponent: () => import('./page/debts/debts.component') },
      { path: 'invoice', loadComponent: () => import('./page/invoice/invoice.component') },
      { path: 'vehicle', loadComponent: () => import('./page/vehicle/vehicle.component') },
      { path: 'month-close', loadComponent: () => import('./page/month-close/month-close.component') },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
