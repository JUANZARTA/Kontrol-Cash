import { Component, HostListener, Inject, PLATFORM_ID } from '@angular/core';
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

  showVehicle = true;
  showLoans = true;
  showDebts = true;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private router: Router,
    private userSettingsService: UserSettingsService
  ) {
    // Solo ejecutar en navegador
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }

    const userId = JSON.parse(localStorage.getItem('user') || '{}')?.localId;
    if (userId) {
      this.userSettingsService.getSettings(userId).subscribe((settings) => {
        this.showVehicle = settings.showVehicle;
        this.showLoans = settings.showLoans;
        this.showDebts = settings.showDebts;
      });
      this.settingsSub = this.userSettingsService.settings$.subscribe((settings) => {
        this.showVehicle = settings.showVehicle;
        this.showLoans = settings.showLoans;
        this.showDebts = settings.showDebts;
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
