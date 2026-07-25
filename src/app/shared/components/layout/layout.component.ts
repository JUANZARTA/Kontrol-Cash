import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { Router, RouterOutlet } from '@angular/router';
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
export default class LayoutComponent implements OnInit {
  private settingsService = inject(UserSettingsService);
  private themeService = inject(ThemeService);
  private closeService = inject(MonthlyCloseService);
  private router = inject(Router);

  autoCloseNotice: { period: string; nextPeriod: string } | null = null;

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

    this.closeService.checkAndRunAutoClose(userId).subscribe(result => {
      if (result) this.autoCloseNotice = result;
    });
  }

  periodLabel(period: string): string {
    return this.closeService.formatPeriodLabel(period);
  }

  goToMonthClose(): void {
    this.autoCloseNotice = null;
    this.router.navigate(['/app/month-close']);
  }

  dismissAutoCloseNotice(): void {
    this.autoCloseNotice = null;
  }
}
