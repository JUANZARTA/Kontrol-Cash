import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { UserSettingsService } from './services/user-settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Mi Cartera';

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private userSettingsService: UserSettingsService
  ) {}

  ngOnInit(): void {
    this.themeService.initTheme();

    const savedAccent = window.localStorage.getItem('mi-cartera-accent');
    this.userSettingsService.applyAccentTheme(savedAccent || '#0ea5e9');

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      window.history.replaceState({}, '', redirect);
      this.router.navigateByUrl(redirect);
    }
  }

}
