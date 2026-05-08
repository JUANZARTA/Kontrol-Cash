import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateService } from '../../../services/date.service';
import { Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';
import { UserSettingsService } from '../../../services/user-settings.service';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, ModalShellComponent, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit, OnDestroy {
  showMonthModal = false;
  years: number[] = [];
  months: string[] = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  currentYear: string = '';
  currentMonth: string = '';
  currentRoute: string = '';

  profilePhotoUrl: string = 'assets/img/logoIcono.png';
  isDarkMode = false;

  private dateSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private themeSubscription?: Subscription;
  private settingsSubscription?: Subscription;

  constructor(
    private dateService: DateService,
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private userSettingsService: UserSettingsService
  ) {}

  ngOnInit(): void {
    this.isDarkMode = this.themeService.isDarkMode();
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    this.profilePhotoUrl = storedUser?.profilePhotoUrl || 'assets/img/logoIcono.png';

    const userId = storedUser?.localId || '';
    if (userId) {
      this.settingsSubscription = this.userSettingsService.settings$.subscribe((settings) => {
        if (settings.profilePhotoUrl) {
          this.profilePhotoUrl = settings.profilePhotoUrl;
        }
      });
      this.userSettingsService.getSettings(userId).subscribe();
    }
    this.themeSubscription = this.themeService.theme$.subscribe((theme) => {
      this.isDarkMode = theme === 'dark';
    });

    this.generateYearRange(2025, 2050);

    const today = new Date();
    const defaultYear = today.getFullYear();
    const defaultMonth = today.getMonth();

    const savedYear = this.dateService.getSelectedYear();
    const savedMonth = this.dateService.getSelectedMonth();

    if (savedYear && savedMonth) {
      this.selectedYear = parseInt(savedYear);
      this.selectedMonth = parseInt(savedMonth) - 1;
      this.dateService.setDate(this.selectedYear, this.selectedMonth + 1);
    } else {
      this.selectedYear = defaultYear;
      this.selectedMonth = defaultMonth;
      this.dateService.setDate(defaultYear, defaultMonth + 1);
    }

    this.dateSubscription = this.dateService.selectedDate$.subscribe(
      ({ year, month }) => {
        this.currentYear = year ?? '';
        this.currentMonth = month ?? '';
      }
    );

    this.routeSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split('/');
        this.currentRoute = this.mapRouteToTitle(path[path.length - 1]);
      }
    });
  }

  ngOnDestroy(): void {
    this.dateSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.themeSubscription?.unsubscribe();
    this.settingsSubscription?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  generateYearRange(start: number, end: number): void {
    this.years = [];
    for (let year = start; year <= end; year++) {
      this.years.push(year);
    }
  }

  openMonthModal(): void {
    this.showMonthModal = true;
  }

  closeMonthModal(): void {
    this.showMonthModal = false;
  }

  clearYearSelection(): void {
    this.selectedYear = null;
  }

  selectYear(year: number): void {
    this.selectedYear = year;
  }

  selectMonth(monthIndex: number): void {
    this.selectedMonth = monthIndex;
    this.showMonthModal = false;

    const mes = monthIndex + 1;
    this.dateService.setDate(this.selectedYear!, mes);
    console.log('Fecha seleccionada →', this.selectedYear, mes);

  }

  mapRouteToTitle(route: string): string {
    switch (route) {
      case 'expense':
        return 'Gastos';
      case 'income':
        return 'Ingresos';
      case 'wallet':
        return 'Cartera';
      case 'saving':
        return 'Ahorros';
      case 'loan':
        return 'Préstamos';
      case 'debt':
        return 'Deudas';
      case 'home':
        return 'Inicio';
      case 'invoice':
        return 'Facturas';
      case 'vehicle':
        return 'Mi Vehículo';
      case 'settings':
        return 'Configuración';
      case 'month-close':
        return 'Cierre Mensual';
      default:
        return this.capitalize(route);
    }
  }

  capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
