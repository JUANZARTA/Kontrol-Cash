import { Component, HostListener, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { UserSettingsService } from '../../../services/user-settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  // Controla si el sidebar está abierto o cerrado
  isSidebarOpen = false;

  // Detecta si es pantalla móvil (<1024px)
  isMobileScreen = false;
  private settingsSub?: Subscription;

  private static readonly COLLAPSE_KEY = 'sidebar-collapsed';

  // Colapsado solo aplica en desktop (md+); en mobile el drawer siempre va completo.
  isSidebarCollapsed = signal(false);

  showVehicle = true;
  showLoans = true;
  showDebts = true;
  showStatistics = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private userSettingsService: UserSettingsService
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
      this.isSidebarCollapsed.set(localStorage.getItem(SidebarComponent.COLLAPSE_KEY) === 'true');
    }

    const userId = JSON.parse(localStorage.getItem('user') || '{}')?.localId;
    if (userId) {
      this.userSettingsService.getSettings(userId).subscribe((settings) => {
        this.showVehicle = settings.showVehicle;
        this.showLoans = settings.showLoans;
        this.showDebts = settings.showDebts;
        this.showStatistics = settings.showStatistics ?? true;
      });
      this.settingsSub = this.userSettingsService.settings$.subscribe((settings) => {
        this.showVehicle = settings.showVehicle;
        this.showLoans = settings.showLoans;
        this.showDebts = settings.showDebts;
        this.showStatistics = settings.showStatistics ?? true;
      });
    }
  }

  /**
   * Alterna el sidebar (solo en móviles)
   */
  toggleSidebar() {
    if (this.isMobile()) {
      this.isSidebarOpen = !this.isSidebarOpen;
    }
  }

  /**
   * Retorna true si es pantalla móvil
   */
  isMobile(): boolean {
    return this.isMobileScreen;
  }

  /**
   * Alterna el colapso del sidebar (solo tiene efecto visual en desktop) y lo persiste.
   */
  toggleCollapse(): void {
    this.isSidebarCollapsed.update(v => !v);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(SidebarComponent.COLLAPSE_KEY, String(this.isSidebarCollapsed()));
    }
  }

  /**
   * Si hay que mostrar los textos de navegación: siempre en mobile (el drawer va completo),
   * y en desktop solo cuando el sidebar no está colapsado.
   */
  get showLabels(): boolean {
    return this.isMobile() || !this.isSidebarCollapsed();
  }

  /**
   * Detecta cambios en el tamaño de la ventana
   */
  @HostListener('window:resize', ['$event'])
  onResize() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  /**
   * Verifica tamaño de pantalla y ajusta sidebar
   */
  checkScreenSize() {
    this.isMobileScreen = window.innerWidth < 1024;

    // En desktop siempre mostrar sidebar
    if (!this.isMobileScreen) {
      this.isSidebarOpen = true;
    } else {
      // En móvil cerrado por defecto
      this.isSidebarOpen = false;
    }
  }

  /**
   * Cierra el sidebar (solo en móvil)
   */
  closeSidebar() {
    if (this.isMobile()) {
      this.isSidebarOpen = false;
    }
  }

  /**
   * Cierra sesión y redirige a login
   */
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.settingsSub?.unsubscribe();
  }
}
