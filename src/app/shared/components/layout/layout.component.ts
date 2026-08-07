import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { UserSettingsService } from '../../../services/user-settings.service';
import { ThemeService } from '../../../services/theme.service';
import { MonthlyCloseService } from '../../../services/monthly-close.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, FooterComponent, RouterOutlet],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export default class LayoutComponent implements OnInit, OnDestroy {
  private settingsService = inject(UserSettingsService);
  private themeService = inject(ThemeService);
  private closeService = inject(MonthlyCloseService);
  private router = inject(Router);

  pendingClose: { year: string; month: string } | null = null;
  private navSub?: Subscription;

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user?.localId;
    if (!userId) return;

    this.settingsService.getSettings(userId).subscribe(settings => {
      if (!settings) return;
      this.themeService.setTheme(settings.darkMode ? 'dark' : 'light');
      this.themeService.setCustomColorMode(
        settings.useCustomColor ?? false,
        settings.accentColor || '#0ea5e9'
      );
    });

    this.checkPendingClose(userId);
    // El guard de rutas ya bloquea la navegación mientras haya un mes pendiente; acá
    // solo recalculamos el aviso para que desaparezca apenas el usuario cierre el mes
    // y navegue a cualquier otra pantalla.
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.checkPendingClose(userId));
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private checkPendingClose(userId: string): void {
    this.closeService.getPendingClosePeriod(userId).subscribe(pending => {
      this.pendingClose = pending;
    });
  }

  get pendingClosePeriodLabel(): string {
    if (!this.pendingClose) return '';
    return this.closeService.formatPeriodLabel(`${this.pendingClose.year}-${this.pendingClose.month}`);
  }

  goToMonthClose(): void {
    this.router.navigate(['/app/month-close']);
  }
}
