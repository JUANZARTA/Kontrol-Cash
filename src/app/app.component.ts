import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Mi Cartera';

  constructor(private router: Router, private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.initTheme();

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      window.history.replaceState({}, '', redirect);
      this.router.navigateByUrl(redirect);
    }
  }

}
